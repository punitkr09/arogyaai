import asyncio
import json
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from app.database import get_db, SessionLocal
from app.db_models import AgentRun, AgentEvent, ActionProposal
from app.agent.orchestrator import AgentOrchestrator
from app.tools.registry import ToolRegistry
from app.schemas import (
    AgentTaskRequest,
    AgentChatRequest,
    AgentRunDetailSchema,
    AgentEventSchema,
    ActionProposalSchema,
)

router = APIRouter(prefix="/api/agent", tags=["Agent"])


@router.get("/templates")
def get_task_templates():
    """Returns realistic operational queries across all supply-chain functional domains."""
    return [
        {
            "id": "tpl-attention",
            "title": "Daily Operations Triage",
            "category": "Operational Triage",
            "prompt": "What should I deal with first this morning?",
            "description": "Comprehensive scan across active recalls, cold-chain temperature spikes, near-expiry inventory, and ICU shortages.",
        },
        {
            "id": "tpl-recall",
            "title": "Batch Recall & Traceability",
            "category": "Recall Containment",
            "prompt": "Investigate recall Batch B2231 and prepare response options.",
            "description": "Trace customer recipients (chemists vs hospitals), isolate warehouse stock, calculate replacement deficit, and stage proposals.",
        },
        {
            "id": "tpl-cold",
            "title": "Cold-Chain Thermal Excursion",
            "category": "Good Distribution Practice",
            "prompt": "Which batches are at risk because their cold room became too warm?",
            "description": "Examine thermal logger spikes, identify biological batches in the affected facility, and stage quarantine review.",
        },
        {
            "id": "tpl-expiry",
            "title": "Expiry & Supplier Return Audit",
            "category": "Loss Prevention & FEFO",
            "prompt": "Are any medicines likely to expire before we can sell them?",
            "description": "Scan 90-day expiry horizon, calculate sell-through velocity, detect FEFO violations, and file vendor return RMA.",
        },
        {
            "id": "tpl-shortage",
            "title": "Critical Medicine Shortage Analysis",
            "category": "Supply Continuity",
            "prompt": "Why is Meropenem showing as a shortage risk?",
            "description": "Calculate Days of Cover (DoC), projected stockout date, and formulate emergency replenishment purchase order.",
        },
        {
            "id": "tpl-comparison",
            "title": "Response Option Comparison",
            "category": "Decision Support",
            "prompt": "Compare returning this stock with transferring it to another warehouse.",
            "description": "Evaluate multi-attribute operational alternatives with quantitative trade-offs.",
        },
    ]


@router.get("/runs", response_model=List[AgentRunDetailSchema])
def list_agent_runs(
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """Lists historical agent investigation runs for compliance and audit logging."""
    runs = db.query(AgentRun).order_by(AgentRun.created_at.desc()).limit(limit).all()
    return [_build_run_detail(db, r) for r in runs]


@router.post("/run", response_model=AgentRunDetailSchema)
def run_agent_task(payload: AgentTaskRequest, db: Session = Depends(get_db)):
    """Executes the multi-stage autonomous operations agent workflow."""
    orchestrator = AgentOrchestrator(db)
    run = orchestrator.run_task(
        prompt=payload.prompt,
        mode=payload.mode,
        incident_id=payload.incident_id,
    )
    return _build_run_detail(db, run)


@router.post("/chat")
def chat_with_agent(payload: AgentChatRequest, db: Session = Depends(get_db)):
    """Conversational natural-language interface for pharmaceutical operations agent."""
    orchestrator = AgentOrchestrator(db)
    run = orchestrator.run_task(
        prompt=payload.message,
        mode=payload.mode or "operations",
        context=payload.context,
    )
    run_detail = _build_run_detail(db, run)
    report = run_detail.final_report

    summary_text = report.incident_summary if report else f"Investigation completed for: {payload.message}"
    recommendation_text = report.recommendation if report else "Review the retrieved operational facts and verification checks."
    full_response = f"{summary_text}\n\n**Recommendation:** {recommendation_text}"

    return {
        "response": full_response,
        "summary": summary_text,
        "recommendation": recommendation_text,
        "facts": report.facts_retrieved if report else {},
        "affected_batches": report.affected_batches if report else [],
        "quantities_reconciled": report.quantities_reconciled if report else {},
        "verification_results": [v.model_dump() for v in report.verification_results] if report else [],
        "proposed_actions": [p.model_dump() for p in run_detail.proposals],
        "run_id": run.id,
        "state": run.state,
    }


@router.post("/create-data")
def agent_create_data(payload: Dict[str, Any], db: Session = Depends(get_db)):
    """Allows creating operational records directly through the Agent Workspace with audit logging and verification.
    Supports record_type: batch, purchase_order, temperature_log, dispatch, customer, supplier, recall.
    """
    record_type = payload.get("record_type")
    data = payload.get("data", {})
    if not record_type:
        raise HTTPException(status_code=400, detail="record_type is required.")
    try:
        res = ToolRegistry.create_operational_record(db, record_type=record_type, data=data)
        return res
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/runs/{run_id}", response_model=AgentRunDetailSchema)
def get_run_details(run_id: str, db: Session = Depends(get_db)):
    """Retrieves full investigation records, execution timeline, and verification evidence for a run."""
    run = db.query(AgentRun).filter_by(id=run_id).first()
    if not run:
        raise HTTPException(status_code=404, detail=f"Run '{run_id}' not found.")
    return _build_run_detail(db, run)


@router.get("/stream/{run_id}")
async def stream_run_events(run_id: str):
    """Server-Sent Events (SSE) streaming endpoint for live agent execution events."""
    async def event_generator():
        last_event_id = 0
        is_completed = False

        while not is_completed:
            db = SessionLocal()
            try:
                run = db.query(AgentRun).filter_by(id=run_id).first()
                if not run:
                    yield f"event: error\ndata: {json.dumps({'error': 'Run not found'})}\n\n"
                    break

                events = (
                    db.query(AgentEvent)
                    .filter(AgentEvent.run_id == run_id, AgentEvent.id > last_event_id)
                    .order_by(AgentEvent.id.asc())
                    .all()
                )

                for ev in events:
                    last_event_id = ev.id
                    payload = {
                        "id": ev.id,
                        "step_number": ev.step_number,
                        "stage": ev.stage,
                        "event_type": ev.event_type,
                        "tool_name": ev.tool_name,
                        "message": ev.message,
                        "data": json.loads(ev.data_json) if ev.data_json else None,
                        "timestamp": ev.timestamp.isoformat(),
                    }
                    yield f"event: agent_event\ndata: {json.dumps(payload)}\n\n"

                if run.state in ["awaiting_approval", "completed", "failed"]:
                    run_detail = _build_run_detail(db, run)
                    yield f"event: run_finished\ndata: {json.dumps(run_detail.model_dump())}\n\n"
                    is_completed = True
                    break

            finally:
                db.close()

            await asyncio.sleep(0.5)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


def _build_run_detail(db: Session, run: AgentRun) -> AgentRunDetailSchema:
    events = (
        db.query(AgentEvent)
        .filter_by(run_id=run.id)
        .order_by(AgentEvent.id.asc())
        .all()
    )
    event_schemas = [
        AgentEventSchema(
            step_number=e.step_number,
            stage=e.stage,
            event_type=e.event_type,
            tool_name=e.tool_name,
            message=e.message,
            data=json.loads(e.data_json) if e.data_json else None,
            timestamp=e.timestamp.isoformat(),
        )
        for e in events
    ]

    proposals = (
        db.query(ActionProposal)
        .filter_by(run_id=run.id)
        .order_by(ActionProposal.id.asc())
        .all()
    )
    proposal_schemas = [
        ActionProposalSchema(
            id=p.id,
            run_id=p.run_id,
            incident_id=p.incident_id,
            action_type=p.action_type,
            title=p.title,
            description=p.description,
            rationale=p.rationale,
            supporting_evidence=json.loads(p.supporting_evidence) if p.supporting_evidence else None,
            target_entity=p.target_entity,
            expected_impact=p.expected_impact,
            status=p.status,
            created_at=p.created_at.isoformat(),
            approved_by=p.approved_by,
            approved_at=p.approved_at.isoformat() if p.approved_at else None,
            rejection_reason=p.rejection_reason,
        )
        for p in proposals
    ]

    return AgentRunDetailSchema(
        run_id=run.id,
        prompt=run.prompt,
        state=run.state,
        current_step=run.current_step,
        created_at=run.created_at.isoformat(),
        completed_at=run.completed_at.isoformat() if run.completed_at else None,
        events=event_schemas,
        plan=json.loads(run.plan_json) if run.plan_json else None,
        evidence=json.loads(run.evidence_json) if run.evidence_json else None,
        verification=json.loads(run.verification_json) if run.verification_json else None,
        final_report=json.loads(run.final_report_json) if run.final_report_json else None,
        proposals=proposal_schemas,
    )
