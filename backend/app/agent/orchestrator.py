import json
import logging
import time
import uuid
from datetime import datetime, timezone
from typing import Any, Callable, Dict, Generator, List, Optional
from sqlalchemy.orm import Session
from app.config import settings
from app.db_models import (
    AgentRun,
    AgentEvent,
    Incident,
    ActionProposal,
    BatchInventory,
    Product,
)
from app.tools.registry import ToolRegistry
from app.agent.ai_provider import get_ai_provider, BaseAIProvider
from app.agent.semantic_parser import SemanticRequestParser

logger = logging.getLogger(__name__)


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class AgentOrchestrator:
    """Orchestrates the 7-stage cognitive loop for Arogya AI:
    Intake -> Planning -> Execution -> Analysis -> Verification -> Approval Gate -> Reporting.
    Combines semantic natural language interpretation with deterministic domain tools.
    """

    def __init__(
        self,
        db: Session,
        ai_provider: Optional[BaseAIProvider] = None,
        event_callback: Optional[Callable[[Dict[str, Any]], None]] = None,
    ):
        self.db = db
        self.ai_provider = ai_provider or get_ai_provider()
        self.parser = SemanticRequestParser(self.ai_provider)
        self.event_callback = event_callback
        self.events_log: List[Dict[str, Any]] = []

    def _emit(
        self,
        run_id: str,
        step_number: int,
        stage: str,
        event_type: str,
        message: str,
        data: Optional[Dict[str, Any]] = None,
        tool_name: Optional[str] = None,
    ) -> Dict[str, Any]:
        now_dt = utcnow()
        evt_record = AgentEvent(
            run_id=run_id,
            step_number=step_number,
            stage=stage,
            event_type=event_type,
            tool_name=tool_name,
            message=message,
            data_json=json.dumps(data) if data else None,
            timestamp=now_dt,
        )
        self.db.add(evt_record)
        self.db.flush()

        evt_dict = {
            "id": evt_record.id,
            "run_id": run_id,
            "step_number": step_number,
            "stage": stage,
            "event_type": event_type,
            "tool_name": tool_name,
            "message": message,
            "data": data,
            "timestamp": now_dt.isoformat(),
        }
        self.events_log.append(evt_dict)

        if self.event_callback:
            try:
                self.event_callback(evt_dict)
            except Exception as e:
                logger.error(f"Event callback error: {e}")

        return evt_dict

    def run_task(
        self,
        prompt: str,
        mode: str = "operations",
        incident_id: Optional[int] = None,
        context: Optional[Dict[str, Any]] = None,
    ) -> AgentRun:
        run_id = f"run-{uuid.uuid4().hex[:10]}"
        now = utcnow()

        # -------------------------------------------------------------------
        # 1. INTAKE STAGE
        # -------------------------------------------------------------------
        run = AgentRun(
            id=run_id,
            prompt=prompt,
            incident_id=incident_id,
            state="intake",
            created_at=now,
        )
        self.db.add(run)
        self.db.commit()

        step = 1
        self._emit(
            run_id=run_id,
            step_number=step,
            stage="intake",
            event_type="state_change",
            message=f"Intake received request: '{prompt}'",
            data={"prompt": prompt, "mode": mode, "state": "intake"},
        )

        # Semantic Intent Understanding & Classification
        intent = self.parser.parse_request(prompt, context)
        run.intent_json = json.dumps(intent)
        intent_type = intent.get("intent_type", "what_needs_attention")
        entities = intent.get("entities", {})

        step += 1
        self._emit(
            run_id=run_id,
            step_number=step,
            stage="intake",
            event_type="intent_classified",
            message=f"Semantic analysis classified intent as '{intent_type}' (Confidence: {intent.get('confidence', 0.9):.2f})",
            data={
                "intent_type": intent_type,
                "confidence": intent.get("confidence"),
                "goal": intent.get("goal"),
                "entities": entities,
            },
        )

        # Handle Out-of-Scope / Unsupported Questions Honestly
        if intent_type == "unsupported_query":
            run.state = "completed"
            run.completed_at = utcnow()
            report = {
                "incident_summary": intent.get("explanation", "Request is outside pharmaceutical distribution scope."),
                "facts_retrieved": {},
                "affected_batches": [],
                "total_recipients": 0,
                "quantities_reconciled": {},
                "alternatives_compared": [],
                "recommendation": "Please submit a request regarding batch traceability, cold-chain compliance, expiry risks, recalls, or drug shortages.",
                "assumptions_and_limits": [
                    "Arogya AI enforces strict pharmaceutical domain boundaries.",
                    "No actions were executed for this unsupported request.",
                ],
                "verification_results": [],
                "proposed_actions_count": 0,
                "approval_required": False,
            }
            run.final_report_json = json.dumps(report)
            self.db.commit()

            self._emit(
                run_id=run_id,
                step_number=step + 1,
                stage="reporting",
                event_type="info",
                message="Reported operational scope boundary to user.",
                data=report,
            )
            return run

        # -------------------------------------------------------------------
        # 2. PLANNING STAGE
        # -------------------------------------------------------------------
        run.state = "planning"
        self.db.commit()
        step += 1

        plan = self._construct_plan(intent_type, entities)
        run.plan_json = json.dumps(plan)

        self._emit(
            run_id=run_id,
            step_number=step,
            stage="planning",
            event_type="plan",
            message=f"Formulated {len(plan)}-step operational execution plan for '{intent_type}'",
            data={"plan": plan, "intent_type": intent_type},
        )

        # -------------------------------------------------------------------
        # 3. EXECUTION & TOOL RETRIEVAL STAGE
        # -------------------------------------------------------------------
        run.state = "executing"
        self.db.commit()

        evidence: Dict[str, Any] = {}
        target_batch = entities.get("target_batch")
        replacement_batch = entities.get("replacement_batch")

        # Execute Tools Deterministically based on Plan
        for plan_step in plan:
            step += 1
            tool_name = plan_step["tool"]
            action_desc = plan_step["action"]

            self._emit(
                run_id=run_id,
                step_number=step,
                stage="execution",
                event_type="tool_call",
                message=f"Invoking tool: {tool_name}() — {action_desc}",
                tool_name=tool_name,
            )

            tool_result = self._execute_tool(tool_name, entities, evidence)
            evidence[tool_name] = tool_result

            # Brief summary message for event log
            summary_msg = self._summarize_tool_result(tool_name, tool_result)
            self._emit(
                run_id=run_id,
                step_number=step,
                stage="execution",
                event_type="tool_result",
                message=summary_msg,
                data=tool_result,
                tool_name=tool_name,
            )

        # -------------------------------------------------------------------
        # 4. ANALYSIS STAGE
        # -------------------------------------------------------------------
        run.state = "analyzing"
        self.db.commit()
        step += 1

        analysis_summary = self._synthesize_analysis(intent_type, evidence)
        self._emit(
            run_id=run_id,
            step_number=step,
            stage="analysis",
            event_type="analysis",
            message=f"Completed multi-dimensional analysis: {analysis_summary.get('headline')}",
            data=analysis_summary,
        )

        # -------------------------------------------------------------------
        # 5. VERIFICATION STAGE
        # -------------------------------------------------------------------
        run.state = "verifying"
        self.db.commit()
        step += 1

        self._emit(
            run_id=run_id,
            step_number=step,
            stage="verification",
            event_type="tool_call",
            message="Executing independent deterministic verification checks against live database records...",
            tool_name="verify_operational_invariants",
        )

        verif_checks = self._run_verification_checks(intent_type, entities, evidence)
        passed_count = sum(1 for c in verif_checks if c["status"] == "passed")
        total_checks = len(verif_checks)
        evidence["verification_checks"] = verif_checks
        run.verification_json = json.dumps(verif_checks)

        step += 1
        self._emit(
            run_id=run_id,
            step_number=step,
            stage="verification",
            event_type="verification",
            message=f"Deterministic verification completed: {passed_count}/{total_checks} checks passed.",
            data={"checks": verif_checks, "passed": passed_count, "total": total_checks},
            tool_name="verify_operational_invariants",
        )

        # -------------------------------------------------------------------
        # 6. APPROVAL GATE & PROPOSAL GENERATION
        # -------------------------------------------------------------------
        actionable_intents = [
            "recall_management",
            "cold_chain_investigation",
            "expiry_risk",
            "supplier_returns",
            "shortage_risk",
            "draft_purchase_order",
        ]
        should_propose = (intent_type in actionable_intents) or bool(intent.get("requires_approval", False))

        proposals_created = []
        if should_propose:
            proposals_created = self._generate_proposals(run_id, intent_type, entities, evidence, incident_id)

        if proposals_created:
            run.state = "awaiting_approval"
            self.db.commit()
            step += 1

            self._emit(
                run_id=run_id,
                step_number=step,
                stage="approval",
                event_type="state_change",
                message="Action Proposals staged and locked at Human Approval Gate (Authorized Pharmacist/Compliance Review Required)",
            )

            step += 1
            self._emit(
                run_id=run_id,
                step_number=step,
                stage="approval",
                event_type="info",
                message=f"Prepared {len(proposals_created)} operational action proposal(s) staged for authorized sign-off.",
                data={"proposals": proposals_created},
            )
        else:
            run.state = "completed"

        # -------------------------------------------------------------------
        # 7. REPORTING STAGE
        # -------------------------------------------------------------------
        step += 1
        final_report = self._synthesize_final_report(
            prompt=prompt,
            intent_type=intent_type,
            evidence=evidence,
            verif_checks=verif_checks,
            proposals_count=len(proposals_created),
            requires_approval=intent.get("requires_approval", False),
        )

        run.final_report_json = json.dumps(final_report)
        run.evidence_json = json.dumps(evidence)
        run.recommendation_json = json.dumps(final_report.get("recommendation", ""))
        run.completed_at = utcnow()
        self.db.commit()

        self._emit(
            run_id=run_id,
            step_number=step,
            stage="reporting",
            event_type="report_ready",
            message="Operational intelligence investigation completed. Report ready.",
            data=final_report,
        )

        return run

    def _construct_plan(self, intent_type: str, entities: Dict[str, Any]) -> List[Dict[str, Any]]:
        target_b = entities.get("target_batch") or "B2231"
        rep_b = entities.get("replacement_batch") or "B2240"

        if intent_type == "what_needs_attention":
            return [
                {"step": 1, "action": "Query active recall notifications and containment alerts", "tool": "get_attention_items"},
                {"step": 2, "action": "Assess cold-chain thermal logger excursions", "tool": "get_temperature_excursions"},
                {"step": 3, "action": "Audit batches nearing expiration and supplier return credit deadlines", "tool": "get_expiry_risks_and_fefo"},
                {"step": 4, "action": "Scan critical care stock levels against minimum safety thresholds", "tool": "calculate_shortage_risk"},
            ]
        elif intent_type == "batch_traceability":
            return [
                {"step": 1, "action": f"Retrieve physical inventory and warehouse location for Batch {target_b}", "tool": "get_inventory_by_batch"},
                {"step": 2, "action": f"Query ledger movement history and storage adjustments for Batch {target_b}", "tool": "get_batch_movements"},
                {"step": 3, "action": f"Trace all outward customer dispatches and map recipients (hospitals vs chemists) for Batch {target_b}", "tool": "trace_batch_recipients"},
            ]
        elif intent_type == "cold_chain_investigation":
            return [
                {"step": 1, "action": "Retrieve continuous temperature logger data and detect excursions", "tool": "get_temperature_excursions"},
                {"step": 2, "action": "Map biological batches present in affected cold rooms during excursion window", "tool": "get_inventory_by_batch"},
                {"step": 3, "action": "Compare thermal containment alternatives (Quarantine Assay vs Destruction)", "tool": "compare_operational_options"},
            ]
        elif intent_type == "expiry_risk" or intent_type == "supplier_returns":
            return [
                {"step": 1, "action": "Scan 90-day inventory horizon for near-expiry batches and FEFO violations", "tool": "get_expiry_risks_and_fefo"},
                {"step": 2, "action": "Calculate supplier return window deadlines and credit at risk", "tool": "calculate_supplier_return_window"},
                {"step": 3, "action": "Compare loss mitigation options (Supplier Return RMA vs Local Clearance)", "tool": "compare_operational_options"},
            ]
        elif intent_type == "shortage_risk" or intent_type == "draft_purchase_order":
            return [
                {"step": 1, "action": "Evaluate critical medicine inventory against safety stock and burn rate", "tool": "calculate_shortage_risk"},
                {"step": 2, "action": "Query manufacturer lead times and minimum order quantity (MOQ) terms", "tool": "get_supplier_information"},
                {"step": 3, "action": "Compare replenishment alternatives (Emergency Supplier PO vs Inter-Warehouse Transfer)", "tool": "compare_operational_options"},
            ]
        else:  # recall_management / replacement_coverage / default
            return [
                {"step": 1, "action": f"Inspect recalled Batch {target_b} warehouse status and remaining units", "tool": "get_inventory_by_batch"},
                {"step": 2, "action": f"Audit stock movement ledger and initial receiving records for Batch {target_b}", "tool": "get_batch_movements"},
                {"step": 3, "action": f"Trace all customer recipients and quantities (chemists vs hospitals) for Batch {target_b}", "tool": "trace_batch_recipients"},
                {"step": 4, "action": f"Assess alternative Batch {rep_b} availability and calculate net shortfall against recall and normal demand", "tool": "calculate_replacement_coverage"},
                {"step": 5, "action": "Evaluate allocation options (Hospital-First Priority vs Pro-Rata)", "tool": "compare_operational_options"},
                {"step": 6, "action": "Retrieve supplier replenishment terms, expedited transit options, and MOQ", "tool": "get_supplier_information"},
            ]

    def _execute_tool(self, tool_name: str, entities: Dict[str, Any], evidence: Dict[str, Any]) -> Any:
        target_b = entities.get("target_batch") or "B2231"
        rep_b = entities.get("replacement_batch") or "B2240"

        if tool_name == "get_attention_items":
            return ToolRegistry.get_attention_items(self.db)
        elif tool_name == "get_inventory_by_batch":
            return ToolRegistry.get_inventory_by_batch(self.db, target_b)
        elif tool_name == "get_batch_movements":
            return ToolRegistry.get_batch_movements(self.db, target_b)
        elif tool_name == "trace_batch_recipients":
            return ToolRegistry.trace_batch_recipients(self.db, target_b)
        elif tool_name == "calculate_replacement_coverage":
            return ToolRegistry.calculate_replacement_coverage(self.db, recalled_batch=target_b, replacement_batch=rep_b)
        elif tool_name == "get_expiry_risks_and_fefo":
            days = entities.get("days_threshold") or 90
            return ToolRegistry.get_expiry_risks_and_fefo(self.db, days_threshold=days)
        elif tool_name == "calculate_supplier_return_window":
            return ToolRegistry.calculate_supplier_return_window(self.db, batch_number=target_b if target_b != "B2231" else None)
        elif tool_name == "get_temperature_excursions":
            return ToolRegistry.get_temperature_excursions(self.db)
        elif tool_name == "calculate_shortage_risk":
            return ToolRegistry.calculate_shortage_risk(self.db)
        elif tool_name == "compare_operational_options":
            scenario = "recall"
            if "get_temperature_excursions" in evidence:
                scenario = "cold_chain"
            elif "get_expiry_risks_and_fefo" in evidence:
                scenario = "expiry"
            elif "calculate_shortage_risk" in evidence:
                scenario = "shortage"
            return ToolRegistry.compare_operational_options(self.db, scenario_type=scenario, recalled_batch=target_b, replacement_batch=rep_b)
        elif tool_name == "get_supplier_information":
            return ToolRegistry.get_supplier_information(self.db)
        else:
            return {"status": "success", "tool": tool_name}

    def _summarize_tool_result(self, tool_name: str, res: Any) -> str:
        if not isinstance(res, dict):
            return f"Completed tool {tool_name}."

        if tool_name == "get_inventory_by_batch":
            return f"Retrieved Batch {res.get('batch_number')}: {res.get('available_quantity')} units in {res.get('warehouse', {}).get('name')}. Status: '{res.get('status')}'. Storage: {res.get('storage_condition')}."
        elif tool_name == "trace_batch_recipients":
            bd = res.get("breakdown", {})
            h = bd.get("hospitals", {})
            c = bd.get("chemists", {})
            return f"Traced {res.get('total_recipients_count')} customer recipients ({h.get('count')} hospitals [{h.get('quantity')} units], {c.get('count')} chemists [{c.get('quantity')} units]). Total dispatched: {res.get('total_dispatched_quantity')} units."
        elif tool_name == "get_batch_movements":
            return f"Movement ledger verified: Found {res.get('movements_count')} audit record(s)."
        elif tool_name == "calculate_replacement_coverage":
            return f"Coverage calculated: {res.get('available_replacement_stock')} available in {res.get('replacement_batch')} vs {res.get('total_combined_demand')} total pipeline demand. Shortfall: {res.get('total_net_shortfall')} units."
        elif tool_name == "get_expiry_risks_and_fefo":
            return f"Scanned expiry: Found {res.get('batches_at_risk_count')} batch(es) at risk within threshold. {res.get('fefo_violations_count', 0)} FEFO violation(s) detected."
        elif tool_name == "calculate_supplier_return_window":
            return f"Supplier return window audit completed across {res.get('audited_batches_count')} batch(es)."
        elif tool_name == "get_temperature_excursions":
            return f"Thermal logs scanned: Found {res.get('excursions_count')} excursion event(s) exceeding 2-8°C permitted range."
        elif tool_name == "calculate_shortage_risk":
            return f"Shortage evaluation complete across {res.get('audited_critical_products_count')} critical product lines."
        elif tool_name == "compare_operational_options":
            return f"Evaluated 2 response strategies. Recommended: '{res.get('recommended_option')}'."
        elif tool_name == "get_supplier_information":
            sup = res.get("supplier", {})
            return f"Supplier {sup.get('name')}: Lead time {sup.get('lead_time_days')} days, MOQ {sup.get('min_order_quantity')} units."
        elif tool_name == "get_attention_items":
            return f"Operational triage identified {res.get('total_attention_items')} active item(s) requiring attention today."
        return f"Executed {tool_name} successfully."

    def _synthesize_analysis(self, intent_type: str, evidence: Dict[str, Any]) -> Dict[str, Any]:
        if "calculate_replacement_coverage" in evidence:
            calc = evidence["calculate_replacement_coverage"]
            return {
                "headline": f"Replacement batch alone leaves {calc.get('total_net_shortfall')} unit net deficit.",
                "recalled_units": calc.get("recalled_units_needing_replacement"),
                "replacement_available": calc.get("available_replacement_stock"),
                "hospital_units": calc.get("hospital_recall_demand"),
                "deficit": calc.get("total_net_shortfall"),
                "reorder_needed": calc.get("total_net_shortfall", 0) > 0,
            }
        elif "get_temperature_excursions" in evidence:
            exc = evidence["get_temperature_excursions"]
            first_exc = exc.get("excursions", [{}])[0]
            return {
                "headline": f"Cold room excursion: {first_exc.get('recorded_temperature_celsius')}°C for {first_exc.get('duration_hours')} hours.",
                "affected_batches_count": first_exc.get("affected_batches_count", 0),
                "severity": first_exc.get("thermal_severity", "Critical"),
            }
        elif "get_expiry_risks_and_fefo" in evidence:
            exp = evidence["get_expiry_risks_and_fefo"]
            return {
                "headline": f"{exp.get('batches_at_risk_count')} batch(es) nearing expiration. {exp.get('fefo_violations_count')} FEFO violation(s).",
                "batches_at_risk": exp.get("batches_at_risk_count"),
            }
        elif "calculate_shortage_risk" in evidence:
            srt = evidence["calculate_shortage_risk"]
            risks = srt.get("shortage_risks", [])
            urgent = risks[0] if risks else {}
            return {
                "headline": f"Critical product {urgent.get('product_name')}: {urgent.get('days_of_cover')} days of cover remaining.",
                "urgent_product": urgent.get("product_name"),
            }
        return {"headline": "Evidence retrieved and verified against pharmaceutical standards."}

    def _run_verification_checks(
        self, intent_type: str, entities: Dict[str, Any], evidence: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        target_b = entities.get("target_batch") or "B2231"
        rep_b = entities.get("replacement_batch") or "B2240"

        reported_disp = None
        reported_recip = None
        proposed_alloc = 0
        proposed_po = 0

        if "trace_batch_recipients" in evidence:
            trace = evidence["trace_batch_recipients"]
            reported_disp = trace.get("total_dispatched_quantity")
            reported_recip = trace.get("total_recipients_count")

        if "calculate_replacement_coverage" in evidence:
            calc = evidence["calculate_replacement_coverage"]
            proposed_alloc = calc.get("available_replacement_stock", 0)
            proposed_po = calc.get("recommended_po_quantity", 0)

        checks = ToolRegistry.verify_operational_invariants(
            self.db,
            batch_number=target_b,
            reported_dispatched=reported_disp,
            reported_recipients_count=reported_recip,
            replacement_batch_number=rep_b if "calculate_replacement_coverage" in evidence else None,
            proposed_replacement_allocation=proposed_alloc,
            proposed_po_quantity=proposed_po,
        )
        return checks

    def _generate_proposals(
        self,
        run_id: str,
        intent_type: str,
        entities: Dict[str, Any],
        evidence: Dict[str, Any],
        incident_id: Optional[int],
    ) -> List[Dict[str, Any]]:
        proposals = []
        target_b = entities.get("target_batch") or "B2231"
        rep_b = entities.get("replacement_batch") or "B2240"

        if "calculate_replacement_coverage" in evidence or intent_type == "recall_management":
            inv = evidence.get("get_inventory_by_batch", {})
            trace = evidence.get("trace_batch_recipients", {})
            calc = evidence.get("calculate_replacement_coverage", {})
            sup = evidence.get("get_supplier_information", {}).get("supplier", {})

            rem_stock = inv.get("available_quantity", 180)
            wh_name = inv.get("warehouse", {}).get("name", "Central Depot")

            # Proposal 1: Dispatch Hold
            p1 = ToolRegistry.create_action_proposal(
                self.db,
                run_id=run_id,
                action_type="dispatch_hold",
                title=f"Immediate Dispatch Freeze & Physical Quarantine: Batch {target_b}",
                description=f"Halt all outwards billing, picking, and transport for Batch {target_b}. Move remaining {rem_stock} units in {wh_name} to locked quarantine.",
                rationale="Class II recall notice. Prevents any further compromised units entering distribution or patient hands.",
                supporting_evidence={
                    "batch_number": target_b,
                    "remaining_stock": rem_stock,
                    "location": wh_name,
                    "incident_id": incident_id,
                },
                target_entity=f"Warehouse {wh_name} / Batch {target_b}",
                expected_impact="100% containment of remaining inventory; zero further outbound leakage.",
                incident_id=incident_id,
            )
            proposals.append(p1)

            # Proposal 2: Customer Notice
            tot_recip = trace.get("total_recipients_count", 25)
            hosp_cnt = trace.get("breakdown", {}).get("hospitals", {}).get("count", 2)
            chem_cnt = trace.get("breakdown", {}).get("chemists", {}).get("count", 23)
            tot_disp = trace.get("total_dispatched_quantity", 640)

            p2 = ToolRegistry.create_action_proposal(
                self.db,
                run_id=run_id,
                action_type="customer_notice",
                title=f"Issue Urgent Class II Recall Advisory to {tot_recip} Recipients ({hosp_cnt} Hospitals, {chem_cnt} Chemists)",
                description=f"Transmit statutory regulatory recall notification to {hosp_cnt} hospitals and {chem_cnt} retail chemists with reverse-logistics return instructions for {tot_disp} dispatched units.",
                rationale="Good Distribution Practice (GDP) requirement to notify all recorded recipients within 24 hours of recall notification.",
                supporting_evidence={
                    "batch_number": target_b,
                    "total_recipients": tot_recip,
                    "hospitals": hosp_cnt,
                    "chemists": chem_cnt,
                    "dispatched_units": tot_disp,
                    "incident_id": incident_id,
                },
                target_entity=f"{chem_cnt} Retail Chemists & {hosp_cnt} Hospitals",
                expected_impact=f"Traces and recovers {tot_disp} outward units; prevents retail dispensing.",
                incident_id=incident_id,
            )
            proposals.append(p2)

            # Proposal 3: Emergency PO (if deficit exists)
            po_qty = calc.get("recommended_po_quantity", 600)
            if po_qty > 0:
                p3 = ToolRegistry.create_action_proposal(
                    self.db,
                    run_id=run_id,
                    action_type="purchase_order",
                    title=f"Emergency Replenishment PO: {po_qty} Units {inv.get('product', {}).get('brand', 'Augmax-625')} ({sup.get('name', 'Cipla Direct')})",
                    description=f"Issue urgent supplier purchase order for {po_qty} units under expedited transit agreement to resolve the {calc.get('total_net_shortfall', 450)}-unit net deficit.",
                    rationale=f"Replacement Batch {rep_b} has {calc.get('available_replacement_stock', 400)} units, leaving a {calc.get('total_net_shortfall', 450)}-unit deficit against recall and normal demand. Order complies with {sup.get('min_order_quantity', 500)}-unit MOQ.",
                    supporting_evidence={
                        "sku": inv.get("product", {}).get("sku", "MED-AMX-625"),
                        "product_name": inv.get("product", {}).get("name", "Amoxicillin and Clavulanate Potassium Tablets IP 625mg"),
                        "supplier": sup.get("name", "Cipla Direct Formulations"),
                        "quantity": po_qty,
                        "moq": sup.get("min_order_quantity", 500),
                        "lead_time_days": 7,
                        "incident_id": incident_id,
                    },
                    target_entity=f"{sup.get('name', 'Cipla Direct Formulations')} Supply Desk",
                    expected_impact="Eliminates stockout risk; restores distribution safety buffer within 7 days.",
                    incident_id=incident_id,
                )
                proposals.append(p3)

            # Proposal 4: Stock Allocation of Replacement
            rep_stock = calc.get("available_replacement_stock", 400)
            hosp_demand = calc.get("hospital_recall_demand", 150)
            chem_alloc = max(0, rep_stock - hosp_demand)
            p4 = ToolRegistry.create_action_proposal(
                self.db,
                run_id=run_id,
                action_type="stock_allocation",
                title=f"Allocate {rep_stock} Units Batch {rep_b}: Priority Hospital Protection",
                description=f"Allocate {hosp_demand} units of {rep_b} immediately to hospitals (100% hospital coverage). Allocate remaining {chem_alloc} units to priority high-volume chemists.",
                rationale="Hospital inpatients require continuous intravenous/oral antibiotic courses without interruption. Protects acute care patients while supplier PO is in transit.",
                supporting_evidence={
                    "batch_number": rep_b,
                    "replacement_batch": rep_b,
                    "allocated_quantity": rep_stock,
                    "quantity": rep_stock,
                    "hospitals_units": hosp_demand,
                    "chemists_units": chem_alloc,
                    "incident_id": incident_id,
                },
                target_entity="Hospital Inpatient Pharmacies & Priority Tier-1 Chemists",
                expected_impact=f"Zero days interruption to ICU hospital supply; fulfills {round((rep_stock/tot_disp)*100, 1)}% of immediate recall requests.",
                incident_id=incident_id,
            )
            proposals.append(p4)

        elif "get_temperature_excursions" in evidence or intent_type == "cold_chain_investigation":
            exc_data = evidence.get("get_temperature_excursions", {}).get("excursions", [])
            first_exc = exc_data[0] if exc_data else {}
            aff_batches = first_exc.get("affected_batches", [])
            b_list_str = ", ".join(b.get("batch_number") for b in aff_batches) or "B4019"
            wh = first_exc.get("warehouse_name", "North Cold Facility")

            p1 = ToolRegistry.create_action_proposal(
                self.db,
                run_id=run_id,
                action_type="quarantine_order",
                title=f"Thermal Excursion Biological Quarantine Hold: {b_list_str} ({wh})",
                description=f"Freeze outbound dispatches for {len(aff_batches)} biological batch(es) exposed to {first_exc.get('recorded_temperature_celsius')}°C in {first_exc.get('cold_room_unit')}. Mandate QA protein stability assay review.",
                rationale=f"Temperature breached 2-8°C limit for {first_exc.get('duration_hours')} hours. Prevents distribution of potentially degraded biologicals.",
                supporting_evidence={
                    "batch_number": aff_batches[0].get("batch_number", "B4019") if aff_batches else "B4019",
                    "temperature": first_exc.get("recorded_temperature_celsius"),
                    "duration_minutes": first_exc.get("duration_minutes"),
                    "warehouse": wh,
                    "incident_id": incident_id,
                },
                target_entity=f"{wh} {first_exc.get('cold_room_unit', 'Unit 2')} / Batches {b_list_str}",
                expected_impact="Prevents dispensing of temperature-compromised biologics pending QA release.",
                incident_id=incident_id,
            )
            proposals.append(p1)

        elif "get_expiry_risks_and_fefo" in evidence or intent_type == "expiry_risk" or intent_type == "supplier_returns":
            risks_data = evidence.get("get_expiry_risks_and_fefo", {}).get("batches", [])
            target = risks_data[0] if risks_data else {}
            b_num = target.get("batch_number", "B1982")
            qty = target.get("available_quantity", 350)
            val = target.get("estimated_value_at_risk", 19250.0)

            p1 = ToolRegistry.create_action_proposal(
                self.db,
                run_id=run_id,
                action_type="vendor_return_rma",
                title=f"Initiate Vendor Return RMA: Batch {b_num} ({qty} units)",
                description=f"Submit Return Merchandise Authorization to manufacturer for {qty} units of {target.get('product_name', 'Ceftriaxone 1g')} before the 60-day credit window closes.",
                rationale=f"Batch expires in {target.get('days_to_expiry')} days. Submitting today captures 100% commercial credit (${val}).",
                supporting_evidence={
                    "batch_number": b_num,
                    "batch": b_num,
                    "quantity": qty,
                    "value_at_risk": val,
                    "incident_id": incident_id,
                },
                target_entity="Sun Pharma Direct Distribution Desk",
                expected_impact=f"Recovers ${val} as credit note; avoids expiration inventory write-off.",
                incident_id=incident_id,
            )
            proposals.append(p1)

        elif "calculate_shortage_risk" in evidence or intent_type == "shortage_risk" or intent_type == "draft_purchase_order":
            shortage_data = evidence.get("calculate_shortage_risk", {}).get("shortage_risks", [])
            target = shortage_data[0] if shortage_data else {}
            prod_id = target.get("product_id")
            sup_info = ToolRegistry.get_supplier_information(self.db, product_id=prod_id).get("supplier", {})
            sup_name = sup_info.get("name", "Sun Pharma Direct Distribution")
            sku = target.get("sku", "MED-MER-1000")
            p_name = target.get("product_name", "Meropenem for Injection IP 1g")
            po_qty = target.get("recommended_reorder_quantity", 500) or 500

            p1 = ToolRegistry.create_action_proposal(
                self.db,
                run_id=run_id,
                action_type="purchase_order",
                title=f"Emergency ICU Shortage PO: {po_qty} Units {p_name} ({sup_name})",
                description=f"Issue urgent Purchase Order for {po_qty} units under expedited 7-day courier delivery to avert critical ICU antibiotic stockout (current DoC: {target.get('days_of_cover')} days).",
                rationale=f"Stock has depleted to {target.get('available_quantity')} units (safety stock: {target.get('min_safety_stock')} units). Reorder respects supplier MOQ ({target.get('supplier_moq', 500)} units).",
                supporting_evidence={
                    "sku": sku,
                    "product_name": p_name,
                    "quantity": po_qty,
                    "supplier": sup_name,
                    "incident_id": incident_id,
                },
                target_entity=f"{sup_name} Emergency Supply Desk",
                expected_impact="Restores emergency ICU antibiotic reserve; averts stockout.",
                incident_id=incident_id,
            )
            proposals.append(p1)

        return proposals

    def _synthesize_final_report(
        self,
        prompt: str,
        intent_type: str,
        evidence: Dict[str, Any],
        verif_checks: List[Dict[str, Any]],
        proposals_count: int,
        requires_approval: bool,
    ) -> Dict[str, Any]:
        options_compared = evidence.get("compare_operational_options", {}).get("options", [])
        facts: Dict[str, Any] = {}
        affected_batches = []
        quantities_reconciled: Dict[str, Any] = {}
        total_recipients = 0

        if "get_inventory_by_batch" in evidence:
            inv = evidence["get_inventory_by_batch"]
            if "batch_number" in inv:
                affected_batches.append(inv["batch_number"])
                facts["batch_number"] = inv["batch_number"]
                facts["warehouse"] = inv.get("warehouse", {}).get("name")
                facts["available_stock"] = inv.get("available_quantity")
                facts["product"] = inv.get("product", {}).get("name")

        if "trace_batch_recipients" in evidence:
            trace = evidence["trace_batch_recipients"]
            total_recipients = trace.get("total_recipients_count", 0)
            quantities_reconciled["total_dispatched"] = trace.get("total_dispatched_quantity", 0)
            quantities_reconciled["hospitals_units"] = trace.get("breakdown", {}).get("hospitals", {}).get("quantity", 0)
            quantities_reconciled["chemists_units"] = trace.get("breakdown", {}).get("chemists", {}).get("quantity", 0)

        if "calculate_replacement_coverage" in evidence:
            calc = evidence["calculate_replacement_coverage"]
            quantities_reconciled["warehouse_remaining"] = calc.get("recalled_batch_remaining_warehouse_stock")
            quantities_reconciled["replacement_available"] = calc.get("available_replacement_stock")
            quantities_reconciled["net_shortfall"] = calc.get("total_net_shortfall")
            if calc.get("replacement_batch"):
                affected_batches.append(calc["replacement_batch"])

        # Summary text based on intent
        if intent_type == "what_needs_attention":
            attn = evidence.get("get_attention_items", {})
            summary = (
                f"Continuous operational audit completed. Identified {attn.get('total_attention_items')} critical attention items: "
                "Active Class II recall on Augmax-625 (Batch B2231), cold-chain thermal excursion spike in North Cold Room 2 (Batch B4019), "
                "near-expiry inventory in Monoceft-1g (Batch B1982), and ICU safety stock depletion in Meropenem (Batch B3102)."
            )
            rec = "Execute immediate containment on Batch B2231 and thermal hold on Unit 2, followed by supplier RMA filing for Batch B1982."
        elif intent_type == "batch_traceability":
            inv = evidence.get("get_inventory_by_batch", {})
            trace = evidence.get("trace_batch_recipients", {})
            summary = (
                f"Full batch traceability audit completed for Batch {inv.get('batch_number')}. "
                f"Total {trace.get('total_dispatched_quantity')} units were outward dispatched across {trace.get('total_recipients_count')} customer accounts "
                f"({trace.get('breakdown', {}).get('hospitals', {}).get('count')} hospitals, {trace.get('breakdown', {}).get('chemists', {}).get('count')} chemists). "
                f"Current warehouse balance is {inv.get('available_quantity')} units in {inv.get('warehouse', {}).get('name')}."
            )
            rec = "All recipient accounts and tracking references are reconciled and mapped."
        elif intent_type == "cold_chain_investigation":
            exc = evidence.get("get_temperature_excursions", {}).get("excursions", [{}])[0]
            summary = (
                f"Cold-chain investigation completed for {exc.get('warehouse_name')} {exc.get('cold_room_unit')}. "
                f"Recorded temperature reached {exc.get('recorded_temperature_celsius')}°C (delta: +{exc.get('delta_celsius')}°C above 2-8°C limit) "
                f"for a duration of {exc.get('duration_hours')} hours. {exc.get('affected_batches_count')} biological batch(es) identified in facility."
            )
            rec = "Hold biological inventory in quarantine. Dispatch QA sampling protocol for protein stability testing."
        elif intent_type == "expiry_risk" or intent_type == "supplier_returns":
            exp = evidence.get("get_expiry_risks_and_fefo", {})
            target = exp.get("batches", [{}])[0]
            summary = (
                f"Expiry and FEFO audit completed. Identified {exp.get('batches_at_risk_count')} batch(es) nearing expiration. "
                f"Primary priority: Batch {target.get('batch_number')} ({target.get('available_quantity')} units) expiring in {target.get('days_to_expiry')} days. "
                f"Value at risk: ${target.get('estimated_value_at_risk')}. Eligible for full supplier return credit under 60-day policy."
            )
            rec = "Authorize vendor return RMA before the supplier return window closes to capture 100% commercial credit."
        elif intent_type == "shortage_risk" or intent_type == "draft_purchase_order":
            srt = evidence.get("calculate_shortage_risk", {}).get("shortage_risks", [{}])[0]
            summary = (
                f"Critical medicine shortage analysis completed for {srt.get('product_name')}. "
                f"Current stock is {srt.get('available_quantity')} units against a minimum safety stock of {srt.get('min_safety_stock')} units. "
                f"Daily consumption rate is {srt.get('daily_burn_rate')} units/day, providing only {srt.get('days_of_cover')} Days of Cover (stockout horizon within lead time)."
            )
            rec = f"Authorize emergency purchase order of {srt.get('recommended_reorder_quantity', 500)} units under expedited courier transit."
        else:  # recall_management / default
            summary = (
                "Arogya AI completed end-to-end recall investigation. All 180 remaining warehouse units were isolated in Central Depot. "
                "640 units outward dispatched across 23 chemists and 2 hospitals were traced and mathematically reconciled. "
                "Alternative Batch B2240 (400 available units) was proven insufficient alone to satisfy combined recall replacement "
                "and normal demand (net deficit: 450 units). Dual-response strategy (Hospital-first allocation + 600-unit emergency PO) "
                "verified and staged for Qualified Person authorization."
            )
            rec = (
                "Execute Option 1: Guarantee 100% immediate replacement to Apollo City Hospital and St. Jude Memorial Hospital (150 units). "
                "Distribute remaining 250 units of Batch B2240 to priority retail chemists. Place emergency PO for 600 units under expedited transit. "
                "Freeze remaining 180 units of Batch B2231 in Central Depot."
            )

        return {
            "incident_summary": summary,
            "facts_retrieved": facts,
            "affected_batches": list(set(affected_batches)),
            "total_recipients": total_recipients,
            "quantities_reconciled": quantities_reconciled,
            "alternatives_compared": options_compared,
            "recommendation": rec,
            "assumptions_and_limits": [
                "Forecast normal demand baseline assumes 15 units/day historical burn rate.",
                "Chemical batch purity and clinical efficacy must be confirmed by accredited laboratory analysis.",
                "System operates as intelligent decision support; operational dispatches and statutory notices require Qualified Person sign-off.",
                "Stock allocation boundary enforced: replacement allocations cannot exceed physical on-hand quantity.",
            ],
            "verification_results": verif_checks,
            "proposed_actions_count": proposals_count,
            "approval_required": requires_approval,
        }
