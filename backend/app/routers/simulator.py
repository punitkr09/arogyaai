import json
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.db_models import AgentRun, ActionProposal, utcnow
from app.simulator.engine import WhatIfSimulatorEngine
from app.agent.ai_provider import get_ai_provider

router = APIRouter(prefix="/api/simulator", tags=["What-If Simulator"])


class SimulationScenarioRequest(BaseModel):
    scenario_type: str = Field(default="recall", description="Type of disruption: recall, cold_chain_excursion, expiry_risk, supplier_delay, competing_hospital_demand, warehouse_shortage")
    batch_number: Optional[str] = None
    product_id: Optional[int] = None
    warehouse_id: Optional[int] = None
    replacement_batch_number: Optional[str] = None
    demand_surge_percent: float = 0.0
    supplier_delay_days: int = 0
    hospital_priority_weight: float = 1.0
    custom_prompt: Optional[str] = None


class ParsePromptRequest(BaseModel):
    prompt: str


class StageSimulationProposalRequest(BaseModel):
    simulation_id: str
    strategy_id: str
    strategy_name: str
    scenario_name: str
    proposals: List[Dict[str, Any]]


class ExplainScenarioRequest(BaseModel):
    prompt: str
    scenario_type: Optional[str] = None
    simulation_id: Optional[str] = None


@router.get("/scenarios")
def get_preset_scenarios():
    """Returns curated operational incidents and benchmark scenarios for instant one-click simulation."""
    return [
        {
            "id": "SCEN-RECALL-B2231",
            "name": "Class II Batch Recall & Replacement Deficit (B2231)",
            "scenario_type": "recall",
            "batch_number": "B2231",
            "replacement_batch_number": "B2232",
            "demand_surge_percent": 0.0,
            "description": "Simulate immediate regulatory recall of Meropenem 1g (Batch B2231). 1,000 units dispatched across 5 hospitals and 3 retail chemists. Reconciles replacement buffer (B2232) and calculates net 450-unit shortage.",
            "severity": "critical",
            "benchmark": True,
        },
        {
            "id": "SCEN-COLD-CHAIN-EXCURSION",
            "name": "Cold Room Thermal Excursion (CR-02 Breach)",
            "scenario_type": "cold_chain_excursion",
            "warehouse_id": 1,
            "batch_number": "B3011",
            "demand_surge_percent": 0.0,
            "description": "Simulate a 12.8°C excursion for 240 minutes in Cold Room CR-02 affecting Insulin Glargine. Compares emergency quarantine & assay testing against proactive replacement dispatch.",
            "severity": "critical",
            "benchmark": False,
        },
        {
            "id": "SCEN-EXPIRY-RMA",
            "name": "Pre-Expiry Stock Liquidation vs Supplier RMA (B1042)",
            "scenario_type": "expiry_risk",
            "batch_number": "B1042",
            "demand_surge_percent": 0.0,
            "description": "Simulate impending 45-day expiration for Amoxicillin 500mg. Compares 100% manufacturer RMA credit return against inter-depot expedited reallocation.",
            "severity": "high",
            "benchmark": False,
        },
        {
            "id": "SCEN-SUPPLIER-DELAY",
            "name": "Primary Manufacturer Production Delay (+14 Days)",
            "scenario_type": "supplier_delay",
            "product_id": 1,
            "supplier_delay_days": 14,
            "demand_surge_percent": 15.0,
            "description": "Simulate a 14-calendar-day delivery delay from Sun Pharma for Ceftriaxone 1g with a 15% regional demand uptick. Tests emergency spot-market purchasing vs safety-stock conservation.",
            "severity": "high",
            "benchmark": False,
        },
        {
            "id": "SCEN-HOSPITAL-SURGE",
            "name": "Tertiary Hospital ICU Respiratory Surge (+35%)",
            "scenario_type": "competing_hospital_demand",
            "product_id": 2,
            "demand_surge_percent": 35.0,
            "hospital_priority_weight": 2.0,
            "description": "Simulate a 35% seasonal demand spike from affiliated hospital intensive care units. Tests strict hospital ring-fencing against first-come first-served commercial distribution.",
            "severity": "medium",
            "benchmark": False,
        },
        {
            "id": "SCEN-DEPOT-SHORTAGE",
            "name": "Regional Warehouse Safety Stock Depletion",
            "scenario_type": "warehouse_shortage",
            "product_id": 1,
            "demand_surge_percent": 25.0,
            "supplier_delay_days": 10,
            "description": "Simulate regional central warehouse stock falling below critical safety buffer. Compares inter-warehouse branch transfers against emergency factory expedited runs.",
            "severity": "high",
            "benchmark": False,
        },
    ]


@router.post("/run")
def run_simulation(
    payload: SimulationScenarioRequest,
    db: Session = Depends(get_db),
):
    """Executes a fully isolated, deterministic What-If simulation without mutating live inventory or creating real orders."""
    engine = WhatIfSimulatorEngine(db=db)
    result = engine.run_simulation(
        scenario_type=payload.scenario_type,
        batch_number=payload.batch_number,
        product_id=payload.product_id,
        warehouse_id=payload.warehouse_id,
        replacement_batch_number=payload.replacement_batch_number,
        demand_surge_percent=payload.demand_surge_percent,
        supplier_delay_days=payload.supplier_delay_days,
        hospital_priority_weight=payload.hospital_priority_weight,
        custom_prompt=payload.custom_prompt,
    )
    return result


@router.post("/parse-prompt")
def parse_prompt(
    payload: ParsePromptRequest,
    db: Session = Depends(get_db),
):
    """Uses natural-language processing to extract structured simulation parameters from user text."""
    engine = WhatIfSimulatorEngine(db=db)
    extracted = engine.parse_natural_language_scenario(payload.prompt)
    return {
        "prompt": payload.prompt,
        "extracted_parameters": extracted,
    }


@router.post("/explain")
def explain_scenario(
    payload: ExplainScenarioRequest,
    db: Session = Depends(get_db),
):
    """Uses the local AI model (or deterministic fallback) to generate an executive briefing explaining what-if scenario dynamics."""
    ai_provider = get_ai_provider()
    system_prompt = (
        "You are Arogya AI's Chief Pharmaceutical Operations & Supply Chain Risk Analyst. "
        "Explain the operational trade-offs, clinical hospital protections, and procurement implications "
        "of the supply chain scenario in crisp, professional, pharmaceutical operations language. "
        "Never invent fake drug dosages or make clinical efficacy claims. Emphasize Qualified Person oversight."
    )
    user_prompt = f"Explain the operational dynamics, trade-offs, and critical decision points for this scenario:\n\n{payload.prompt}"
    
    explanation = ai_provider.generate_text(
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        temperature=0.3,
    )
    return {
        "prompt": payload.prompt,
        "explanation": explanation,
    }


@router.post("/propose")
def stage_proposal_for_approval(
    payload: StageSimulationProposalRequest,
    db: Session = Depends(get_db),
):
    """Stages a simulated strategy into official ActionProposals requiring Qualified Person (R.Ph) sign-off.
    
    Creates real records in `agent_runs` and `action_proposals` with status='pending_review'.
    Does NOT mutate stock or dispatches until an authorized person approves it through the Approval Center.
    """
    run_id = f"RUN-SIM-{uuid.uuid4().hex[:8].upper()}"
    now_dt = utcnow()

    # 1. Create container AgentRun
    agent_run = AgentRun(
        id=run_id,
        prompt=f"What-If Staged Action Plan: {payload.scenario_name} [{payload.strategy_name}]",
        state="awaiting_approval",
        intent_json=json.dumps({
            "simulation_id": payload.simulation_id,
            "strategy_id": payload.strategy_id,
            "scenario_name": payload.scenario_name,
            "staged_from": "what_if_simulator",
        }),
        recommendation_json=json.dumps({
            "strategy_id": payload.strategy_id,
            "strategy_name": payload.strategy_name,
            "proposals_count": len(payload.proposals),
        }),
        evidence_json=json.dumps({
            "simulation_id": payload.simulation_id,
            "strategy_id": payload.strategy_id,
            "staged_at": now_dt.isoformat(),
        }),
        created_at=now_dt,
    )
    db.add(agent_run)

    # 2. Create ActionProposal records
    created_proposals = []
    for prop in payload.proposals:
        evidence_data = prop.get("evidence", {})
        if not evidence_data:
            evidence_data = {
                "simulation_id": payload.simulation_id,
                "strategy_id": payload.strategy_id,
                "action_type": prop.get("action_type"),
                "target_entity": prop.get("target_entity"),
            }

        action_prop = ActionProposal(
            run_id=run_id,
            action_type=prop.get("action_type", "dispatch_hold"),
            title=prop.get("title", f"Staged {prop.get('action_type', 'Action')}"),
            description=prop.get("description", "Action proposed from What-If Supply Chain Simulator."),
            rationale=prop.get("rationale", f"Originates from What-If Simulation {payload.simulation_id} Strategy: {payload.strategy_name}."),
            target_entity=prop.get("target_entity", "Inventory"),
            expected_impact=prop.get("expected_impact", "Maintains supply chain continuity and regulatory compliance."),
            supporting_evidence=json.dumps(evidence_data),
            status="pending_review",
            created_at=now_dt,
        )
        db.add(action_prop)
        created_proposals.append(action_prop)

    db.commit()

    # Refresh to capture generated IDs
    created_ids = [p.id for p in created_proposals]

    return {
        "success": True,
        "run_id": run_id,
        "created_proposal_ids": created_ids,
        "message": f"Successfully staged {len(created_ids)} action proposal(s) for Qualified Person approval in the Approval Center.",
        "approval_center_url": "/approvals",
    }
