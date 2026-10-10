import math
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session

from app.db_models import (
    BatchInventory,
    Product,
    Warehouse,
    Customer,
    Dispatch,
    Supplier,
    TemperatureLog,
    StockMovement,
    ActionProposal,
)
from app.tools.registry import ToolRegistry
from app.agent.ai_provider import get_ai_provider


class WhatIfSimulatorEngine:
    """Arogya AI What-If Supply Chain Simulation Engine.
    
    Executes isolated, deterministic simulations of operational disruptions
    (recalls, cold excursions, expiry risks, supplier delays, hospital surges)
    without mutating live database state or creating real ledger entries.
    """

    def __init__(self, db: Session):
        self.db = db
        self.ai_provider = get_ai_provider()

    def parse_natural_language_scenario(self, prompt: str) -> Dict[str, Any]:
        """Uses the local AI model or deterministic parser to extract simulation parameters."""
        prompt_lower = prompt.lower()
        params: Dict[str, Any] = {
            "scenario_type": "recall",
            "batch_number": None,
            "product_id": None,
            "demand_surge_percent": 0.0,
            "supplier_delay_days": 0,
            "hospital_priority_weight": 1.0,
        }

        import re

        # Check for scenario type
        if "cold" in prompt_lower or "temperature" in prompt_lower or "excursion" in prompt_lower:
            params["scenario_type"] = "cold_chain_excursion"
        elif "hospital" in prompt_lower and ("surge" in prompt_lower or "compete" in prompt_lower or "demand" in prompt_lower):
            params["scenario_type"] = "competing_hospital_demand"
        elif bool(re.search(r"\b(delay|delayed|delays|lead time|late)\b", prompt_lower)):
            params["scenario_type"] = "supplier_delay"
        elif "shortage" in prompt_lower or "stockout" in prompt_lower:
            params["scenario_type"] = "warehouse_shortage"
        elif "expir" in prompt_lower or "return" in prompt_lower or bool(re.search(r"\brma\b", prompt_lower)):
            params["scenario_type"] = "expiry_risk"
        else:
            params["scenario_type"] = "recall"

        # Extract batch numbers
        import re
        batch_match = re.search(r"\b([a-zA-Z]\d{3,5})\b", prompt)
        if batch_match:
            params["batch_number"] = batch_match.group(1).upper()
        elif "b2231" in prompt_lower:
            params["batch_number"] = "B2231"
        elif "b1042" in prompt_lower:
            params["batch_number"] = "B1042"
        elif "b3011" in prompt_lower:
            params["batch_number"] = "B3011"
        elif "b4019" in prompt_lower:
            params["batch_number"] = "B4019"

        # Extract delay days
        delay_match = re.search(r"(\d+)\s*(?:day|days)", prompt_lower)
        if delay_match:
            val = int(delay_match.group(1))
            if "delay" in prompt_lower or "late" in prompt_lower:
                params["supplier_delay_days"] = val
            elif "surge" in prompt_lower or "demand" in prompt_lower:
                params["demand_surge_percent"] = float(val)

        # Extract percent surges
        pct_match = re.search(r"(\d+)\s*%", prompt_lower)
        if pct_match:
            params["demand_surge_percent"] = float(pct_match.group(1))

        return params

    def run_simulation(
        self,
        scenario_type: str,
        batch_number: Optional[str] = None,
        product_id: Optional[int] = None,
        warehouse_id: Optional[int] = None,
        replacement_batch_number: Optional[str] = None,
        demand_surge_percent: float = 0.0,
        supplier_delay_days: int = 0,
        hospital_priority_weight: float = 1.0,
        custom_prompt: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Runs the deterministic simulation across at least two feasible strategies in complete isolation."""
        sim_id = f"SIM-{uuid.uuid4().hex[:8].upper()}"

        # If natural language custom prompt provided, blend parameters
        if custom_prompt and not batch_number:
            extracted = self.parse_natural_language_scenario(custom_prompt)
            scenario_type = extracted["scenario_type"]
            batch_number = extracted["batch_number"] or batch_number
            if extracted["supplier_delay_days"] > 0:
                supplier_delay_days = extracted["supplier_delay_days"]
            if extracted["demand_surge_percent"] > 0:
                demand_surge_percent = extracted["demand_surge_percent"]

        # Route to appropriate deterministic simulation handler
        if scenario_type == "cold_chain_excursion":
            result = self._simulate_cold_chain_excursion(sim_id, warehouse_id, batch_number, demand_surge_percent)
        elif scenario_type == "expiry_risk":
            result = self._simulate_expiry_risk(sim_id, batch_number, demand_surge_percent)
        elif scenario_type == "supplier_delay":
            result = self._simulate_supplier_delay(sim_id, batch_number, product_id, supplier_delay_days, demand_surge_percent)
        elif scenario_type == "competing_hospital_demand":
            result = self._simulate_hospital_demand_surge(sim_id, batch_number, product_id, demand_surge_percent, hospital_priority_weight)
        elif scenario_type == "warehouse_shortage":
            result = self._simulate_warehouse_shortage(sim_id, batch_number, product_id, demand_surge_percent)
        else:  # default to recall scenario
            result = self._simulate_recall(
                sim_id=sim_id,
                batch_number=batch_number or "B2231",
                replacement_batch=replacement_batch_number or "B2232",
                demand_surge_percent=demand_surge_percent,
                hospital_priority_weight=hospital_priority_weight,
            )

        # Attach standard pharmaceutical safety notice and evidence audit
        result["clinical_safety_notice"] = (
            "Arogya AI What-If Simulator provides mathematical, financial, and operational projections only. "
            "It does not make clinical drug safety determinations. Consequential actions require Qualified Person (R.Ph) authorization."
        )

        return result

    # -----------------------------------------------------------------------
    # 1. Recall & Replacement Simulation
    # -----------------------------------------------------------------------
    def _simulate_recall(
        self,
        sim_id: str,
        batch_number: str,
        replacement_batch: str,
        demand_surge_percent: float,
        hospital_priority_weight: float,
    ) -> Dict[str, Any]:
        """Simulates a regulatory batch recall, outward recipient defense, and replacement inventory math."""
        # Query target batch
        target = self.db.query(BatchInventory).filter_by(batch_number=batch_number).first()
        if not target:
            target = self.db.query(BatchInventory).first()
            batch_number = target.batch_number if target else "B2231"

        product = target.product if target else self.db.query(Product).first()

        # Query replacement batch
        rep_batch = self.db.query(BatchInventory).filter_by(batch_number=replacement_batch).first()
        if not rep_batch:
            # Pick any alternate active batch of the same product or second batch in DB
            rep_batch = (
                self.db.query(BatchInventory)
                .filter(BatchInventory.product_id == product.id, BatchInventory.batch_number != batch_number)
                .first()
            )
        replacement_units = rep_batch.available_quantity if rep_batch else 0
        rep_batch_code = rep_batch.batch_number if rep_batch else "NONE"

        # Outward customer exposure
        dispatches = self.db.query(Dispatch).filter_by(batch_id=target.id).all() if target else []
        total_dispatched = sum(d.quantity for d in dispatches)
        hosp_dispatches = [d for d in dispatches if d.customer.customer_type == "hospital"]
        chem_dispatches = [d for d in dispatches if d.customer.customer_type != "hospital"]

        hospital_units_dispatched = sum(d.quantity for d in hosp_dispatches)
        chemist_units_dispatched = sum(d.quantity for d in chem_dispatches)

        # Baseline demand & surge
        daily_demand = max(4, int(product.min_safety_stock / 20)) if product else 5
        base_30d_demand = daily_demand * 30
        surge_mult = 1.0 + (demand_surge_percent / 100.0)
        projected_30d_demand = int(base_30d_demand * surge_mult)

        # Total replacement requirement
        total_replacement_demand = total_dispatched + projected_30d_demand
        net_deficit = total_replacement_demand - replacement_units

        # Supplier details
        supplier = self.db.query(Supplier).first()
        supplier_moq = supplier.min_order_quantity if supplier else 500
        supplier_name = supplier.name if supplier else "Primary Manufacturer"
        lead_time_days = supplier.lead_time_days if supplier else 7

        # Calculate Emergency Order Units (must satisfy deficit and supplier MOQ)
        required_po_units = max(supplier_moq, net_deficit) if net_deficit > 0 else 0

        # STRATEGY 1: Priority Hospital Protection & Expedited Procurement
        hosp_demand_total = hospital_units_dispatched + int(projected_30d_demand * 0.4)
        hosp_units_allocated = min(replacement_units, hosp_demand_total)
        hosp_fulfillment_pct = round((hosp_units_allocated / hosp_demand_total * 100.0) if hosp_demand_total > 0 else 100.0, 1)

        remaining_for_chemists = max(0, replacement_units - hosp_units_allocated)
        chem_demand_total = chemist_units_dispatched + int(projected_30d_demand * 0.6)
        chem_fulfillment_pct = round((remaining_for_chemists / chem_demand_total * 100.0) if chem_demand_total > 0 else 100.0, 1)

        strat_1_cost = required_po_units * (product.unit_price if product else 25.0)

        strat_1: Dict[str, Any] = {
            "strategy_id": "STRAT-1-HOSPITAL-PRIORITY-PO",
            "name": "Strategy 1: Priority Hospital Defense & Emergency Supplier Order",
            "description": (
                f"Guarantees 100% replacement stock to Tier 1 hospital accounts ({hosp_units_allocated} units); "
                f"allocates remaining {remaining_for_chemists} units to priority retail pharmacies; "
                f"issues emergency Purchase Order for {required_po_units} units to {supplier_name} under expedited delivery."
            ),
            "hospital_fulfillment_percent": hosp_fulfillment_pct,
            "retail_fulfillment_percent": chem_fulfillment_pct,
            "replacement_deficit": net_deficit,
            "emergency_order_units": required_po_units,
            "estimated_cost": float(strat_1_cost),
            "lead_time_days": lead_time_days,
            "projected_runway_days": int(replacement_units / daily_demand) if daily_demand > 0 else 60,
            "pros": [
                "100% protection for acute hospital ICU & inpatient wards",
                f"Adheres to supplier MOQ ({supplier_moq} units) with verified delivery window ({lead_time_days} days)",
                "Completely mitigates clinical stockout risk during active recall",
            ],
            "cons": [
                f"Temporary partial allocation ({chem_fulfillment_pct}%) to community retail pharmacies until PO arrives",
                f"Incurs immediate procurement outlay of ₹{strat_1_cost:,.2f}",
            ],
            "is_recommended": True,
            "action_proposals": [
                {
                    "action_type": "dispatch_hold",
                    "title": f"Recall Dispatch Freeze: Batch {batch_number}",
                    "description": f"Freeze outward dispatches for {target.available_quantity if target else 0} units of recalled batch {batch_number}.",
                    "target_entity": f"Batch {batch_number}",
                    "rationale": "Class II regulatory recall compliance. Immediate containment.",
                    "expected_impact": "Prevents any additional compromised units from entering the healthcare supply chain.",
                },
                {
                    "action_type": "purchase_order",
                    "title": f"Emergency Replenishment PO: {required_po_units} Units {product.name if product else ''}",
                    "description": f"Expedited purchase order to {supplier_name} for {required_po_units} units.",
                    "target_entity": f"{product.name if product else ''} ({product.sku if product else ''})",
                    "rationale": f"Replaces recalled lot {batch_number} and covers {net_deficit} unit net projected deficit.",
                    "expected_impact": f"Eliminates stockout risk; restores regional depot safety stock.",
                },
            ],
        }

        # STRATEGY 2: Pro-Rata Equal Rationing (No Emergency Order)
        total_demand_all = hosp_demand_total + chem_demand_total
        pro_rata_ratio = min(1.0, replacement_units / total_demand_all) if total_demand_all > 0 else 1.0
        strat_2_hosp_pct = round(pro_rata_ratio * 100.0, 1)
        strat_2_chem_pct = round(pro_rata_ratio * 100.0, 1)

        strat_2: Dict[str, Any] = {
            "strategy_id": "STRAT-2-PRO-RATA-RATIONING",
            "name": "Strategy 2: Pro-Rata Equal Rationing Across All Accounts",
            "description": (
                f"Distributes replacement inventory {rep_batch_code} ({replacement_units} units) equally across all accounts "
                f"at {strat_2_hosp_pct}% allocation ratio. No emergency purchase order issued."
            ),
            "hospital_fulfillment_percent": strat_2_hosp_pct,
            "retail_fulfillment_percent": strat_2_chem_pct,
            "replacement_deficit": net_deficit,
            "emergency_order_units": 0,
            "estimated_cost": 0.0,
            "lead_time_days": 0,
            "projected_runway_days": int(replacement_units / daily_demand) if daily_demand > 0 else 30,
            "pros": [
                "Zero capital expenditure (no emergency purchase order created)",
                "Equal percentage allocation perceived as fair by retail chemist network",
            ],
            "cons": [
                f"Hospital ICU wards suffer {round(100 - strat_2_hosp_pct, 1)}% shortfall on critical antibiotic formulation",
                f"Severe patient care risk: regional hospital supply depleted within {int(strat_2_hosp_pct/10)} days",
                "Fails to resolve the underlying inventory deficit",
            ],
            "is_recommended": False,
            "action_proposals": [
                {
                    "action_type": "dispatch_hold",
                    "title": f"Recall Dispatch Freeze: Batch {batch_number}",
                    "description": f"Freeze outward dispatches for batch {batch_number}.",
                    "target_entity": f"Batch {batch_number}",
                    "rationale": "Regulatory containment.",
                    "expected_impact": "Blocks recalled stock.",
                }
            ],
        }

        # STRATEGY 3: Inter-Warehouse Transfer & Bridge Stock
        alt_wh = self.db.query(Warehouse).filter(Warehouse.code != "WH-CENTRAL").first()
        alt_wh_name = alt_wh.name if alt_wh else "West Coast Express Depot"
        transfer_units = min(150, int(replacement_units * 0.3))

        strat_3: Dict[str, Any] = {
            "strategy_id": "STRAT-3-INTER-WAREHOUSE-TRANSFER",
            "name": f"Strategy 3: Inter-Depot Stock Transfer from {alt_wh_name}",
            "description": (
                f"Initiate expedited transfer of {transfer_units} units from {alt_wh_name} to bridge hospital demand, "
                f"while placing a reduced supplier order for {max(supplier_moq, net_deficit - transfer_units)} units."
            ),
            "hospital_fulfillment_percent": min(100.0, round(hosp_fulfillment_pct + 15.0, 1)),
            "retail_fulfillment_percent": chem_fulfillment_pct,
            "replacement_deficit": max(0, net_deficit - transfer_units),
            "emergency_order_units": max(supplier_moq, net_deficit - transfer_units),
            "estimated_cost": float((max(supplier_moq, net_deficit - transfer_units)) * (product.unit_price if product else 25.0)),
            "lead_time_days": 3,
            "projected_runway_days": int((replacement_units + transfer_units) / daily_demand) if daily_demand > 0 else 45,
            "pros": [
                "Faster delivery (3-day inter-depot transit vs. 7-day factory order)",
                "Reduces emergency supplier order quantity requirement",
            ],
            "cons": [
                f"Depletes safety stock buffer at secondary warehouse ({alt_wh_name})",
                "Incurs inter-facility logistics handling costs",
            ],
            "is_recommended": False,
            "action_proposals": [
                {
                    "action_type": "stock_allocation",
                    "title": f"Inter-Warehouse Transfer: {transfer_units} Units {product.name if product else ''}",
                    "description": f"Transfer {transfer_units} units from {alt_wh_name} to Central Pharmaceutical Depot.",
                    "target_entity": f"Transfer {alt_wh_name} -> Central Depot",
                    "rationale": "Bridges acute hospital replacement shortfall.",
                    "expected_impact": "Provides 3-day buffer while primary manufacturing batch completes.",
                }
            ],
        }

        # AI executive summary
        summary_text = (
            f"Simulation {sim_id}: Investigated Class II recall scenario for Batch {batch_number} ({product.name if product else ''}). "
            f"Target batch has {target.available_quantity if target else 0} units held in depot and {total_dispatched} units outward dispatched "
            f"across {len(dispatches)} facilities ({len(hosp_dispatches)} hospitals, {len(chem_dispatches)} retail chemists). "
            f"Available replacement lot {rep_batch_code} provides {replacement_units} units against total requirement of {total_replacement_demand} units, "
            f"resulting in a net replacement deficit of {net_deficit} units. "
            f"Strategy 1 (Priority Hospital Defense & Expedited Emergency Order of {required_po_units} units) is recommended to prevent acute care stockouts."
        )

        return {
            "simulation_id": sim_id,
            "scenario_name": f"Batch {batch_number} Recall & Multi-Strategy Replacement Analysis",
            "scenario_type": "recall",
            "parameters_used": {
                "batch_number": batch_number,
                "replacement_batch": rep_batch_code,
                "demand_surge_percent": demand_surge_percent,
                "hospital_priority_weight": hospital_priority_weight,
            },
            "baseline": {
                "recalled_batch_depot_units": target.available_quantity if target else 0,
                "recalled_batch_dispatched_units": total_dispatched,
                "hospital_units_at_risk": hospital_units_dispatched,
                "chemist_units_at_risk": chemist_units_dispatched,
                "replacement_batch_available_units": replacement_units,
                "daily_demand_burn_rate": daily_demand,
                "projected_30d_demand": projected_30d_demand,
            },
            "strategies": [strat_1, strat_2, strat_3],
            "recommended_strategy_id": "STRAT-1-HOSPITAL-PRIORITY-PO",
            "executive_summary": summary_text,
            "assumptions": [
                f"Historical daily demand burn rate is estimated at {daily_demand} units/day.",
                f"Outward recalled stock of {total_dispatched} units requires 100% physical lot replacement.",
                f"Supplier Master Services Agreement (MSA) mandates minimum order quantity (MOQ) of {supplier_moq} units.",
                f"Air freight expedited courier transit time is estimated at {lead_time_days} calendar days.",
            ],
            "missing_data": [
                "Patient-level dispensed count vs. unsold shelf inventory at retail chemists cannot be confirmed without field return receipts.",
                "Chemical stability assay confirmation for factory production schedule is pending.",
            ],
            "evidence": {
                "batch_number": batch_number,
                "warehouse_location": target.warehouse.name if target and target.warehouse else "Central Depot",
                "product_sku": product.sku if product else "MED-AMX-500",
                "hospitals_exposed": [d.customer.name for d in hosp_dispatches],
                "supplier_name": supplier_name,
                "supplier_moq": supplier_moq,
            },
        }

    # -----------------------------------------------------------------------
    # 2. Cold-Chain Excursion Simulation
    # -----------------------------------------------------------------------
    def _simulate_cold_chain_excursion(
        self,
        sim_id: str,
        warehouse_id: Optional[int],
        batch_number: Optional[str],
        demand_surge_percent: float,
    ) -> Dict[str, Any]:
        """Simulates thermal breaches in cold rooms and models containment & replacement strategies."""
        excursions = self.db.query(TemperatureLog).filter(TemperatureLog.temperature_celsius > 8.0).all()
        target_log = excursions[0] if excursions else None

        cold_batches = (
            self.db.query(BatchInventory)
            .filter(BatchInventory.storage_condition.ilike("%cold%"))
            .all()
        )
        affected_units = sum(b.available_quantity for b in cold_batches) if cold_batches else 500

        strat_1: Dict[str, Any] = {
            "strategy_id": "STRAT-1-QUARANTINE-STABILITY-ASSAY",
            "name": "Strategy 1: Immediate Quarantine Hold & Expedited Lab Stability Assay",
            "description": (
                f"Place immediate dispatch freeze on {affected_units} biological units exposed to excursion; "
                f"dispatch samples for 48-hour HPLC protein stability testing; hold stock pending Qualified Person release."
            ),
            "hospital_fulfillment_percent": 100.0,
            "retail_fulfillment_percent": 80.0,
            "replacement_deficit": 0,
            "emergency_order_units": 0,
            "estimated_cost": 15000.0,  # lab testing fee
            "lead_time_days": 2,
            "projected_runway_days": 45,
            "pros": [
                "Prevents unnecessary destruction of commercially viable inventory if assay passes",
                "Maintains strict regulatory adherence to Good Distribution Practice (GDP)",
            ],
            "cons": [
                "48-hour temporary inventory hold while awaiting accredited lab certificate of analysis",
            ],
            "is_recommended": True,
            "action_proposals": [
                {
                    "action_type": "quarantine_order",
                    "title": "Thermal Excursion Quarantine: Cold Room Unit 2",
                    "description": f"Freeze {affected_units} units pending stability testing review.",
                    "target_entity": "North Cold Logistics Hub CR-02",
                    "rationale": "Recorded temperature exceeded 8°C upper threshold.",
                    "expected_impact": "Blocks compromised biologics from patient administration.",
                }
            ],
        }

        strat_2: Dict[str, Any] = {
            "strategy_id": "STRAT-2-IMMEDIATE-WRITE-OFF-REPLACEMENT-PO",
            "name": "Strategy 2: Immediate Batch Write-Off & Emergency Factory Replenishment",
            "description": (
                f"Condemn and destroy all {affected_units} units immediately without laboratory testing; "
                f"issue emergency purchase order to manufacturer for 500 replacement units."
            ),
            "hospital_fulfillment_percent": 70.0,
            "retail_fulfillment_percent": 40.0,
            "replacement_deficit": affected_units,
            "emergency_order_units": 500,
            "estimated_cost": 90000.0,
            "lead_time_days": 7,
            "projected_runway_days": 10,
            "pros": [
                "Absolute zero clinical risk of degraded biological proteins reaching patients",
            ],
            "cons": [
                f"Severe financial write-off loss of ₹90,000 without testing",
                "Creates temporary 7-day regional stockout until factory order arrives",
            ],
            "is_recommended": False,
            "action_proposals": [],
        }

        return {
            "simulation_id": sim_id,
            "scenario_name": "Cold-Chain Thermal Excursion Containment Simulation",
            "scenario_type": "cold_chain_excursion",
            "parameters_used": {
                "warehouse_id": warehouse_id or 2,
                "breach_temperature_celsius": target_log.temperature_celsius if target_log else 12.8,
                "duration_minutes": target_log.duration_minutes if target_log else 270,
            },
            "baseline": {
                "affected_cold_rooms": ["Cold Room Unit 2 (WH-NORTH)"],
                "affected_units_count": affected_units,
                "recorded_temperature": target_log.temperature_celsius if target_log else 12.8,
                "permitted_range": "2°C - 8°C",
            },
            "strategies": [strat_1, strat_2],
            "recommended_strategy_id": "STRAT-1-QUARANTINE-STABILITY-ASSAY",
            "executive_summary": (
                f"Simulation {sim_id}: Analyzed thermal breach in Cold Room Unit 2. "
                f"Peak temperature reached 12.8°C (+4.8°C excursion) for 4.5 hours affecting {affected_units} biological units. "
                f"Strategy 1 (Quarantine & 48-Hour Stability Assay) is recommended to protect clinical safety while avoiding premature inventory destruction."
            ),
            "assumptions": [
                "Cold room compressor cycle malfunction is isolated to Unit 2.",
                "Accredited third-party analytical laboratory has 48-hour SLA for protein integrity chromatography.",
            ],
            "missing_data": [
                "Mean Kinetic Temperature (MKT) calculation pending full datalogger CSV export.",
            ],
            "evidence": {
                "sensor_reading_temp": target_log.temperature_celsius if target_log else 12.8,
                "duration_hours": 4.5,
                "warehouse_code": "WH-NORTH",
            },
        }


    # -----------------------------------------------------------------------
    # 3. Expiry Risk & Vendor Return RMA Simulation
    # -----------------------------------------------------------------------
    def _simulate_expiry_risk(
        self,
        sim_id: str,
        batch_number: Optional[str],
        demand_surge_percent: float,
    ) -> Dict[str, Any]:
        """Simulates batches approaching expiry and evaluates vendor return credit vs outward FEFO push."""
        near_expiry_batches = ToolRegistry.get_expiry_risks_and_fefo(self.db, days_threshold=90)
        batch_info = near_expiry_batches.get("batches_near_expiry", [{}])[0] if near_expiry_batches.get("batches_near_expiry") else {}

        target_batch = batch_info.get("batch_number", batch_number or "B1042")
        target_qty = batch_info.get("available_quantity", 150)
        days_to_expiry = batch_info.get("days_to_expiry", 42)
        salvage_value = target_qty * 180.0

        strat_1: Dict[str, Any] = {
            "strategy_id": "STRAT-1-VENDOR-RETURN-RMA",
            "name": "Strategy 1: Immediate Vendor Return Authorization (RMA Credit Capture)",
            "description": (
                f"Submit formal Return Merchandise Authorization (RMA) to manufacturer for Batch {target_batch} ({target_qty} units). "
                f"Recovers ₹{salvage_value:,.2f} full contractual vendor credit before the 45-day pre-expiry window closes."
            ),
            "hospital_fulfillment_percent": 100.0,
            "retail_fulfillment_percent": 100.0,
            "replacement_deficit": 0,
            "emergency_order_units": 0,
            "estimated_cost": -salvage_value,  # credit gain
            "lead_time_days": 3,
            "projected_runway_days": 60,
            "pros": [
                f"Recovers 100% credit value (₹{salvage_value:,.2f}) before contract window closes",
                "Eliminates risk of unsold inventory expiring in customer hands",
            ],
            "cons": [
                f"Requires physical reverse logistics dispatch back to factory warehouse within 6 days",
            ],
            "is_recommended": True,
            "action_proposals": [
                {
                    "action_type": "vendor_return_rma",
                    "title": f"Vendor Return RMA: Batch {target_batch} (Sun Pharma)",
                    "description": f"Process return of {target_qty} units before 45-day deadline expires.",
                    "target_entity": f"Batch {target_batch}",
                    "rationale": "Preserves vendor credit recovery under Master Services Agreement.",
                    "expected_impact": f"Secures ₹{salvage_value:,.2f} credit against future inventory invoices.",
                }
            ],
        }

        strat_2: Dict[str, Any] = {
            "strategy_id": "STRAT-2-DISCOUNTED-FEFO-PUSH",
            "name": "Strategy 2: Discounted Promotional FEFO Outward Push to Retailers",
            "description": (
                f"Offer 20% promotional discount to retail chemists to liquidate {target_qty} units of Batch {target_batch} "
                f"prior to expiration date ({days_to_expiry} days remaining)."
            ),
            "hospital_fulfillment_percent": 100.0,
            "retail_fulfillment_percent": 100.0,
            "replacement_deficit": 0,
            "emergency_order_units": 0,
            "estimated_cost": -(salvage_value * 0.8),
            "lead_time_days": 1,
            "projected_runway_days": 20,
            "pros": [
                "Generates immediate cash flow from retail chemist accounts",
            ],
            "cons": [
                "High probability of chemist stock holding units past expiry, creating patient safety liability",
                f"Sacrifices ₹{salvage_value * 0.2:,.2f} in discounted margin compared to 100% vendor credit RMA",
            ],
            "is_recommended": False,
            "action_proposals": [],
        }

        return {
            "simulation_id": sim_id,
            "scenario_name": f"Batch {target_batch} Expiry Risk & Vendor Return Strategy Analysis",
            "scenario_type": "expiry_risk",
            "parameters_used": {
                "batch_number": target_batch,
                "days_to_expiry": days_to_expiry,
                "units_at_risk": target_qty,
            },
            "baseline": {
                "batch_number": target_batch,
                "available_quantity": target_qty,
                "days_to_expiry": days_to_expiry,
                "contract_return_window_days": 45,
                "days_remaining_in_window": 6,
                "potential_credit_value": salvage_value,
            },
            "strategies": [strat_1, strat_2],
            "recommended_strategy_id": "STRAT-1-VENDOR-RETURN-RMA",
            "executive_summary": (
                f"Simulation {sim_id}: Batch {target_batch} has {target_qty} units expiring in {days_to_expiry} days. "
                f"Supplier contract allows full credit return up to 45 days prior to expiration (window closes in 6 days). "
                f"Strategy 1 (RMA Return) captures ₹{salvage_value:,.2f} credit with zero write-off loss."
            ),
            "assumptions": [
                "Manufacturer MSA allows 100% credit for unopened, seal-intact packaging returned within window.",
                "Warehouse logistics team can complete packing and dispatch within 72 hours.",
            ],
            "missing_data": [
                "Manufacturer RMA approval response time (typically 2 business days).",
            ],
            "evidence": {
                "target_batch": target_batch,
                "days_left": days_to_expiry,
                "salvage_credit": salvage_value,
            },
        }

    # -----------------------------------------------------------------------
    # 4. Supplier Delay & Lead Time Stress Simulation
    # -----------------------------------------------------------------------
    def _simulate_supplier_delay(
        self,
        sim_id: str,
        batch_number: Optional[str],
        product_id: Optional[int],
        supplier_delay_days: int,
        demand_surge_percent: float,
    ) -> Dict[str, Any]:
        """Simulates supplier factory manufacturing delays and models stockout horizons."""
        delay = max(7, supplier_delay_days if supplier_delay_days > 0 else 14)
        product = self.db.query(Product).filter_by(id=product_id).first() if product_id else self.db.query(Product).first()

        batches = self.db.query(BatchInventory).filter_by(product_id=product.id).all() if product else []
        usable_units = sum(b.available_quantity for b in batches if b.status == "active")
        daily_demand = max(4, int(product.min_safety_stock / 20)) if product else 5
        base_runway = int(usable_units / daily_demand) if daily_demand > 0 else 60

        projected_runway_after_delay = base_runway - delay
        stockout_imminent = projected_runway_after_delay < 15

        strat_1: Dict[str, Any] = {
            "strategy_id": "STRAT-1-SECONDARY-SUPPLIER-EXPEDITE",
            "name": f"Strategy 1: Secondary Supplier Emergency Order (Bridge {delay}-Day Delay)",
            "description": (
                f"Engage secondary certified pharmaceutical distributor to procure 400 units under expedited 4-day delivery. "
                f"Prevents depot stockout while awaiting primary factory shipment."
            ),
            "hospital_fulfillment_percent": 100.0,
            "retail_fulfillment_percent": 90.0,
            "replacement_deficit": 0,
            "emergency_order_units": 400,
            "estimated_cost": float(400 * (product.unit_price * 1.15 if product else 30.0)),
            "lead_time_days": 4,
            "projected_runway_days": max(15, base_runway),
            "pros": [
                f"Completely absorbs primary supplier's {delay}-day delay",
                "Maintains hospital delivery service-level agreement (SLA) above 98%",
            ],
            "cons": [
                "15% spot-market freight and procurement price premium from secondary source",
            ],
            "is_recommended": True,
            "action_proposals": [
                {
                    "action_type": "purchase_order",
                    "title": f"Secondary Source PO: 400 Units {product.name if product else ''}",
                    "description": f"Bridge purchase order to absorb {delay}-day manufacturing delay.",
                    "target_entity": f"Secondary Supplier for {product.name if product else ''}",
                    "rationale": f"Primary manufacturer delayed by {delay} days; prevents stockout.",
                    "expected_impact": "Secures 400 units within 4 days.",
                }
            ],
        }

        strat_2: Dict[str, Any] = {
            "strategy_id": "STRAT-2-DEMAND-RATIONING-HOLD",
            "name": "Strategy 2: Strict Demand Rationing & Safety Stock Dip",
            "description": (
                f"Ration outward distribution to 50% for non-hospital accounts. Allow warehouse inventory "
                f"to dip below minimum safety stock threshold until delayed primary shipment arrives."
            ),
            "hospital_fulfillment_percent": 100.0,
            "retail_fulfillment_percent": 50.0,
            "replacement_deficit": max(0, daily_demand * delay - usable_units),
            "emergency_order_units": 0,
            "estimated_cost": 0.0,
            "lead_time_days": delay,
            "projected_runway_days": max(5, projected_runway_after_delay),
            "pros": [
                "Zero additional procurement cost; relies on existing pipeline",
            ],
            "cons": [
                f"Regional depot runs on critical reserve (<{projected_runway_after_delay} days runway)",
                "Retail chemists face stockouts and backorders for 2 weeks",
            ],
            "is_recommended": False,
            "action_proposals": [],
        }

        return {
            "simulation_id": sim_id,
            "scenario_name": f"{product.name if product else 'Medicine'} Supplier {delay}-Day Delay Simulation",
            "scenario_type": "supplier_delay",
            "parameters_used": {
                "product_id": product.id if product else 1,
                "supplier_delay_days": delay,
                "demand_surge_percent": demand_surge_percent,
            },
            "baseline": {
                "product_name": product.name if product else "Amoxicillin",
                "usable_stock": usable_units,
                "daily_burn_rate": daily_demand,
                "original_runway_days": base_runway,
                "runway_after_delay_days": projected_runway_after_delay,
                "stockout_risk": "Critical" if stockout_imminent else "Medium",
            },
            "strategies": [strat_1, strat_2],
            "recommended_strategy_id": "STRAT-1-SECONDARY-SUPPLIER-EXPEDITE",
            "executive_summary": (
                f"Simulation {sim_id}: Evaluated impact of a {delay}-day manufacturing delay for {product.name if product else 'Formulation'}. "
                f"Current usable stock ({usable_units} units) provides {base_runway} days of runway. "
                f"The delay reduces effective buffer to {projected_runway_after_delay} days. "
                f"Strategy 1 (Secondary Source PO of 400 units) is recommended to avoid depot stockout."
            ),
            "assumptions": [
                f"Primary supplier factory dispatch delayed by {delay} days due to raw material batch release testing.",
                "Secondary certified distributor has ready stock in Mumbai / NCR depot.",
            ],
            "missing_data": [
                "Confirmed dispatch date from secondary distributor's central WMS.",
            ],
            "evidence": {
                "product_sku": product.sku if product else "MED-AMX-500",
                "current_usable_stock": usable_units,
                "min_safety_stock": product.min_safety_stock if product else 100,
            },
        }

    # -----------------------------------------------------------------------
    # 5. Competing Hospital Demand Surge Simulation
    # -----------------------------------------------------------------------
    def _simulate_hospital_demand_surge(
        self,
        sim_id: str,
        batch_number: Optional[str],
        product_id: Optional[int],
        demand_surge_percent: float,
        hospital_priority_weight: float,
    ) -> Dict[str, Any]:
        """Simulates acute surge in Tier 1 Hospital ICU demand vs community chemist supply."""
        surge = max(25.0, demand_surge_percent if demand_surge_percent > 0 else 35.0)
        product = self.db.query(Product).filter_by(id=product_id).first() if product_id else self.db.query(Product).first()

        batches = self.db.query(BatchInventory).filter_by(product_id=product.id, status="active").all() if product else []
        usable_units = sum(b.available_quantity for b in batches)
        base_hosp_demand = 200
        surged_hosp_demand = int(base_hosp_demand * (1.0 + surge / 100.0))
        chem_demand = 180

        strat_1: Dict[str, Any] = {
            "strategy_id": "STRAT-1-HOSPITAL-RINGFENCE",
            "name": f"Strategy 1: 100% Hospital Ring-Fence ({surge}% Surge Protection)",
            "description": (
                f"Ring-fence {surged_hosp_demand} units exclusively for Tier 1 ICU hospital networks (Apex Heart, Lilavati, Fortis). "
                f"Allocate remaining {max(0, usable_units - surged_hosp_demand)} units to retail chemists."
            ),
            "hospital_fulfillment_percent": 100.0,
            "retail_fulfillment_percent": round((max(0, usable_units - surged_hosp_demand) / chem_demand) * 100.0, 1) if chem_demand > 0 else 100.0,
            "replacement_deficit": max(0, surged_hosp_demand + chem_demand - usable_units),
            "emergency_order_units": 500,
            "estimated_cost": float(500 * (product.unit_price if product else 25.0)),
            "lead_time_days": 7,
            "projected_runway_days": 35,
            "pros": [
                "Zero ICU patient stockouts across tertiary hospitals",
                "Adheres strictly to healthcare priority tiering protocol",
            ],
            "cons": [
                "Community pharmacies receive reduced allocation until replenishment batch arrives",
            ],
            "is_recommended": True,
            "action_proposals": [
                {
                    "action_type": "stock_allocation",
                    "title": f"Ring-Fence Stock for Hospitals: {product.name if product else ''}",
                    "description": f"Allocate {surged_hosp_demand} units to Tier 1 hospitals under {surge}% surge condition.",
                    "target_entity": f"Tier 1 Hospitals ({product.name if product else ''})",
                    "rationale": "Clinical critical care protection protocol.",
                    "expected_impact": "Guarantees 100% hospital availability.",
                }
            ],
        }

        strat_2: Dict[str, Any] = {
            "strategy_id": "STRAT-2-UNRESTRICTED-FCFS",
            "name": "Strategy 2: Unrestricted First-Come First-Served Allocation",
            "description": (
                f"Fulfill outward orders on a first-come, first-served basis without hospital ring-fencing. "
                f"Retail chemists receive orders immediately, creating potential hospital deficits."
            ),
            "hospital_fulfillment_percent": 68.0,
            "retail_fulfillment_percent": 95.0,
            "replacement_deficit": max(0, surged_hosp_demand + chem_demand - usable_units),
            "emergency_order_units": 0,
            "estimated_cost": 0.0,
            "lead_time_days": 0,
            "projected_runway_days": 20,
            "pros": [
                "Fast fulfillment for early commercial orders",
            ],
            "cons": [
                "Hospitals face stockout during emergency ICU cases (32% unfilled critical orders)",
                "Violates distribution priority agreements with hospital chains",
            ],
            "is_recommended": False,
            "action_proposals": [],
        }

        return {
            "simulation_id": sim_id,
            "scenario_name": f"Hospital ICU Demand Surge (+{surge}%) Simulation",
            "scenario_type": "competing_hospital_demand",
            "parameters_used": {
                "product_id": product.id if product else 1,
                "surge_percentage": surge,
                "hospital_priority_weight": hospital_priority_weight,
            },
            "baseline": {
                "product_name": product.name if product else "Formulation",
                "normal_hospital_demand": base_hosp_demand,
                "surged_hospital_demand": surged_hosp_demand,
                "chemist_demand": chem_demand,
                "total_available_stock": usable_units,
            },
            "strategies": [strat_1, strat_2],
            "recommended_strategy_id": "STRAT-1-HOSPITAL-RINGFENCE",
            "executive_summary": (
                f"Simulation {sim_id}: Analyzed a {surge}% surge in Tier 1 Hospital ICU demand for {product.name if product else 'Medicine'}. "
                f"Surged demand requires {surged_hosp_demand} units against {usable_units} available units. "
                f"Strategy 1 (Hospital Ring-Fencing & Expedited Replenishment) is recommended to protect life-saving inpatient care."
            ),
            "assumptions": [
                f"Tertiary hospitals submit expedited requisitions for emergency respiratory/ICU patient admissions.",
                "Warehouse management system enforces priority tiering flags during pick-and-pack.",
            ],
            "missing_data": [
                "Real-time bed occupancy telemetry from affiliated hospital networks.",
            ],
            "evidence": {
                "product_name": product.name if product else "Medicine",
                "current_stock": usable_units,
                "surge_percent": surge,
            },
        }

    # -----------------------------------------------------------------------
    # 6. Warehouse Shortage Simulation
    # -----------------------------------------------------------------------
    def _simulate_warehouse_shortage(
        self,
        sim_id: str,
        batch_number: Optional[str],
        product_id: Optional[int],
        demand_surge_percent: float,
    ) -> Dict[str, Any]:
        """Simulates warehouse shortage where stock dips below minimum safety stock."""
        return self._simulate_supplier_delay(
            sim_id=sim_id,
            batch_number=batch_number,
            product_id=product_id,
            supplier_delay_days=10,
            demand_surge_percent=demand_surge_percent or 20.0,
        )
