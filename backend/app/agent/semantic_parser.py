import json
import logging
import re
from datetime import datetime
from typing import Any, Dict, List, Optional
from app.agent.ai_provider import BaseAIProvider

logger = logging.getLogger(__name__)


class SemanticRequestParser:
    """Interprets natural-language operations requests semantically into structured intent,
    entities, required tools, constraints, and operational goals.
    """

    KNOWN_BATCHES = ["B2231", "B2240", "B1982", "B4019", "B3102", "B5011", "B7033", "CS-7790", "CS-7731", "VD-1180", "VD-1201", "IG-3302", "P-5560", "B0999"]
    KNOWN_PRODUCTS = {
        "amoxicillin": "PH-004",
        "augmax": "PH-004",
        "ceftriaxone": "PH-052",
        "monoceft": "PH-052",
        "insulin": "PH-013",
        "glargine": "PH-013",
        "glaritus": "PH-013",
        "meropenem": "MED-MER-1000",
        "meronext": "MED-MER-1000",
        "paracetamol": "PH-001",
        "dolo": "PH-001",
        "pantoprazole": "PH-026",
        "pan-40": "PH-026",
        "azithromycin": "PH-007",
        "cough syrup": "PH-031",
        "vitamin d3": "PH-043",
        "ondansetron": "PH-051",
        "enoxaparin": "PH-055",
        "losartan": "PH-060",
        "montelukast": "PH-065",
        "diclofenac": "PH-067",
    }
    KNOWN_WAREHOUSES = {
        "central": "WH-CENTRAL",
        "bhiwandi": "WH-CENTRAL",
        "north": "WH-NORTH",
        "ncr": "WH-NORTH",
        "west": "WH-WEST",
        "pune": "WH-WEST",
        "bengaluru": "WH-BLR",
        "bangalore": "WH-BLR",
        "blr": "WH-BLR",
        "mysuru": "WH-MYS",
        "mysore": "WH-MYS",
        "mys": "WH-MYS",
        "hubballi": "WH-HUB",
        "hubli": "WH-HUB",
        "hub": "WH-HUB",
    }

    def __init__(self, ai_provider: Optional[BaseAIProvider] = None):
        self.ai_provider = ai_provider

    def parse_request(
        self,
        prompt: str,
        context: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Runs multi-strategy semantic parsing:
        1. If AI provider is available, attempts structured LLM intent classification.
        2. Always verifies/enriches with deterministic entity resolution and pharmaceutical invariants.
        3. If LLM is offline or times out, uses deterministic semantic parsing seamlessly.
        """
        raw_prompt = prompt.strip()
        entities = self._extract_entities(raw_prompt, context)

        # Attempt LLM-assisted classification if configured and healthy
        llm_intent: Optional[Dict[str, Any]] = None
        if self.ai_provider:
            try:
                llm_intent = self._classify_via_llm(raw_prompt, entities, context)
            except Exception as e:
                logger.info(f"LLM classification bypassed: {str(e)}")
                llm_intent = None

        if llm_intent and self._validate_llm_intent(llm_intent):
            # Merge LLM intent with verified database-compatible entities
            intent = llm_intent
            intent["entities"] = self._merge_entities(intent.get("entities", {}), entities)
        else:
            intent = self._classify_deterministic(raw_prompt, entities, context)

        return intent

    def _extract_entities(
        self, prompt: str, context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        p_lower = prompt.lower()
        extracted: Dict[str, Any] = {
            "batches": [],
            "products": [],
            "warehouses": [],
            "customer_types": [],
            "purchase_orders": [],
            "quantity": None,
            "days_threshold": None,
            "target_batch": None,
            "replacement_batch": None,
        }

        # 1. Batches (Pattern: B followed by 4 digits, or alphanumeric code like CS-7790, VD-1180, IG-3302)
        matches = re.findall(r"\b([A-Za-z]{1,2}-\d{3,4}|[A-Za-z]\d{4})\b", prompt)
        for m in matches:
            b_norm = m.upper()
            if not b_norm.startswith("PO-") and b_norm not in extracted["batches"]:
                extracted["batches"].append(b_norm)

        # If context has a recent batch and none found, check context
        if not extracted["batches"] and context and context.get("target_batch"):
            extracted["batches"].append(context["target_batch"])

        if extracted["batches"]:
            extracted["target_batch"] = extracted["batches"][0]
            if len(extracted["batches"]) > 1:
                extracted["replacement_batch"] = extracted["batches"][1]

        # 2. Products / SKUs
        sku_matches = re.findall(r"\b(PH-\d{3}|MED-[A-Z]+-\d+)\b", prompt, re.IGNORECASE)
        for sm in sku_matches:
            sm_norm = sm.upper()
            if sm_norm not in extracted["products"]:
                extracted["products"].append(sm_norm)

        for prod_term, sku in self.KNOWN_PRODUCTS.items():
            if prod_term in p_lower and sku not in extracted["products"]:
                extracted["products"].append(sku)

        # 3. Warehouses
        for wh_term, wh_code in self.KNOWN_WAREHOUSES.items():
            if wh_term in p_lower and wh_code not in extracted["warehouses"]:
                extracted["warehouses"].append(wh_code)

        # 4. Customer Types
        if "hospital" in p_lower or "icu" in p_lower:
            extracted["customer_types"].append("hospital")
        if "chemist" in p_lower or "pharmacy" in p_lower or "retail" in p_lower:
            extracted["customer_types"].append("chemist")

        # 5. Purchase Orders
        po_matches = re.findall(r"\b(PO-\d{3,5}|PO-[A-Z0-9-]+)\b", prompt, re.IGNORECASE)
        for po_m in po_matches:
            extracted["purchase_orders"].append(po_m.upper())

        # 6. Quantity / numbers
        qty_matches = re.findall(r"\b(\d+)\s*(?:units?|doses?|boxes?|packs?)\b", p_lower)
        if qty_matches:
            try:
                extracted["quantity"] = int(qty_matches[0])
            except ValueError:
                pass

        # 7. Days threshold
        days_matches = re.findall(r"\b(\d+)\s*days?\b", p_lower)
        if days_matches:
            try:
                extracted["days_threshold"] = int(days_matches[0])
            except ValueError:
                pass

        return extracted

    def _classify_via_llm(
        self, prompt: str, entities: Dict[str, Any], context: Optional[Dict[str, Any]]
    ) -> Optional[Dict[str, Any]]:
        system_prompt = (
            "You are the Natural Language Intent Classifier for Arogya AI, a pharmaceutical operations agent. "
            "Analyze the user's request and classify into one of the operational categories: "
            "['overdue_purchase_orders', 'dispatch_demand_analytics', 'recalled_stock_lookup', "
            "'warehouse_stock_comparison', 'cold_room_excursions', 'replenishment_needs', "
            "'latest_recall_trace', 'critical_medicines_shortage', 'batches_expiring_horizon', "
            "'risk_factor_explanation', 'evidence_explanation', 'what_needs_attention', "
            "'batch_traceability', 'batch_investigation', 'expiry_risk', 'supplier_returns', "
            "'cold_chain_investigation', 'recall_management', 'replacement_coverage', "
            "'shortage_risk', 'decision_comparison', 'draft_purchase_order', 'pending_approvals', "
            "'unsupported_query']. "
            "Respond ONLY with valid JSON following this exact structure: "
            "{\"intent_type\": string, \"confidence\": float, \"goal\": string, \"requires_approval\": bool, "
            "\"recommended_tools\": [string], \"entities\": {\"target_batch\": string or null, \"replacement_batch\": string or null, \"target_product\": string or null}}"
        )

        user_content = f"User Request: {prompt}\nExtracted Entities: {json.dumps(entities)}"
        if context:
            user_content += f"\nConversation Context: {json.dumps(context)}"

        res = self.ai_provider.generate_completion(
            messages=[{"role": "user", "content": user_content}],
            system_prompt=system_prompt,
            json_mode=True,
            temperature=0.0,
            timeout=2.0,
        )

        content = res.get("content", "").strip()
        if content.startswith("```"):
            content = re.sub(r"^```(?:json)?\n", "", content)
            content = re.sub(r"\n```$", "", content)

        data = json.loads(content)
        return data

    def _validate_llm_intent(self, intent: Dict[str, Any]) -> bool:
        valid_intents = [
            "overdue_purchase_orders",
            "dispatch_demand_analytics",
            "recalled_stock_lookup",
            "warehouse_stock_comparison",
            "cold_room_excursions",
            "replenishment_needs",
            "latest_recall_trace",
            "critical_medicines_shortage",
            "batches_expiring_horizon",
            "risk_factor_explanation",
            "evidence_explanation",
            "what_needs_attention",
            "batch_traceability",
            "batch_investigation",
            "expiry_risk",
            "supplier_returns",
            "cold_chain_investigation",
            "recall_management",
            "replacement_coverage",
            "shortage_risk",
            "decision_comparison",
            "draft_purchase_order",
            "pending_approvals",
            "unsupported_query",
        ]
        return (
            isinstance(intent, dict)
            and intent.get("intent_type") in valid_intents
            and "recommended_tools" in intent
        )

    def _merge_entities(self, llm_ents: Dict[str, Any], det_ents: Dict[str, Any]) -> Dict[str, Any]:
        merged = dict(det_ents)
        if isinstance(llm_ents, dict):
            if llm_ents.get("target_batch") and not merged.get("target_batch"):
                merged["target_batch"] = llm_ents["target_batch"]
            if llm_ents.get("replacement_batch") and not merged.get("replacement_batch"):
                merged["replacement_batch"] = llm_ents["replacement_batch"]
        return merged

    def _classify_deterministic(
        self, prompt: str, entities: Dict[str, Any], context: Optional[Dict[str, Any]]
    ) -> Dict[str, Any]:
        p = prompt.lower().strip()

        # Check for out-of-scope/unsupported general queries
        out_of_scope_patterns = [
            r"\bweather\b",
            r"\bjoke\b",
            r"\bmovie\b",
            r"\bpresident\b",
            r"\bcapital of\b",
            r"\bwrite a poem\b",
            r"\bwho won\b",
            r"\bwho is the king\b",
        ]
        if any(re.search(pat, p) for pat in out_of_scope_patterns):
            return {
                "intent_type": "unsupported_query",
                "confidence": 0.95,
                "goal": "Request is outside pharmaceutical distribution operations scope",
                "requires_approval": False,
                "recommended_tools": [],
                "entities": entities,
                "explanation": (
                    "Arogya AI is specialized for pharmaceutical distribution operations, batch traceability, "
                    "cold-chain thermal compliance, expiry management, recall containment, and critical medicine shortages. "
                    "This question falls outside pharmaceutical distribution operations."
                ),
            }

        # -------------------------------------------------------------------
        # 0. Operational Data Ingestion & Creation Actions via Agent Workspace
        # -------------------------------------------------------------------
        if any(term in p for term in ["add batch", "create batch", "new batch lot", "ingest batch", "register batch"]):
            # Extract batch number
            b_match = re.search(r"\b([A-Za-z0-9\-]+(?:-\d+)?)\b", prompt)
            batch_num = entities.get("target_batch") or (b_match.group(1) if b_match else f"B-LOT-{datetime.now().strftime('%m%d%H%M')}")
            qty_match = re.search(r"(\d+)\s*(?:units?|qty|tablets?|vials?|amps?)", p)
            qty = int(qty_match.group(1)) if qty_match else 500
            wh = entities.get("warehouses", ["BLR"])[0] if entities.get("warehouses") else "BLR"
            prod_sku = entities.get("products", ["PH-001"])[0] if entities.get("products") else "PH-001"
            date_match = re.search(r"\b(\d{4}-\d{2}-\d{2})\b", prompt)
            exp_date = date_match.group(1) if date_match else "2027-12-31"

            entities["record_type"] = "batch"
            entities["record_data"] = {
                "batch_number": batch_num,
                "sku": prod_sku,
                "quantity": qty,
                "warehouse": wh,
                "expiry_date": exp_date,
            }
            return {
                "intent_type": "add_batch_data",
                "confidence": 0.99,
                "goal": f"Ingest new operational Batch Lot {batch_num} ({qty} units) into {wh} warehouse",
                "requires_approval": False,
                "recommended_tools": ["verify_operational_invariants", "create_operational_record"],
                "entities": entities,
            }

        if any(term in p for term in ["create purchase order", "create po", "new purchase order", "new po", "raise po", "order stock", "place po"]):
            qty_match = re.search(r"(\d+)\s*(?:units?|qty)", p)
            qty = int(qty_match.group(1)) if qty_match else 500
            prod_sku = entities.get("products", ["PH-002"])[0] if entities.get("products") else "PH-002"
            sup_name = None
            for s in ["sun", "cipla", "dr. reddy", "biocon", "lupin", "zydus", "alkem", "torrent", "mankind", "aurobindo"]:
                if s in p:
                    sup_name = s.title()
                    break

            entities["record_type"] = "purchase_order"
            entities["record_data"] = {
                "sku": prod_sku,
                "quantity": qty,
                "supplier_name": sup_name,
                "notes": prompt,
            }
            return {
                "intent_type": "create_po_data",
                "confidence": 0.99,
                "goal": f"Create operational Purchase Order for {qty} units of SKU {prod_sku}",
                "requires_approval": True,
                "recommended_tools": ["verify_operational_invariants", "create_operational_record"],
                "entities": entities,
            }

        if any(term in p for term in ["log temperature", "record temperature", "log excursion", "temperature check"]):
            temp_match = re.search(r"(-?\d+(?:\.\d+)?)\s*(?:°?c|deg|degrees)?", p)
            temp = float(temp_match.group(1)) if temp_match else 5.0
            dur_match = re.search(r"(\d+)\s*(?:min|mins|minutes|hours|h)", p)
            dur = int(dur_match.group(1)) if dur_match else 0
            room_match = re.search(r"(cr-?\s*\d+|cold\s*room\s*(?:unit\s*)?\d+)", p)
            room = room_match.group(1).upper() if room_match else "Cold Room Unit 2"
            wh = entities.get("warehouses", ["Mysuru"])[0] if entities.get("warehouses") else "Mysuru"

            entities["record_type"] = "temperature_log"
            entities["record_data"] = {
                "warehouse": wh,
                "cold_room_unit": room,
                "recorded_temperature_celsius": temp,
                "duration_minutes": dur,
                "notes": prompt,
            }
            return {
                "intent_type": "log_temp_data",
                "confidence": 0.99,
                "goal": f"Record thermal sensor reading {temp}°C in {room} ({wh})",
                "requires_approval": False,
                "recommended_tools": ["verify_operational_invariants", "create_operational_record"],
                "entities": entities,
            }

        if any(term in p for term in ["record dispatch", "dispatch batch", "create dispatch"]):
            qty_match = re.search(r"(\d+)\s*(?:units?|qty)", p)
            qty = int(qty_match.group(1)) if qty_match else 50
            batch_num = entities.get("target_batch") or "B2219"
            cust_match = re.search(r"\b(c-\d+)\b", p)
            cust_code = cust_match.group(1).upper() if cust_match else "C-001"

            entities["record_type"] = "dispatch"
            entities["record_data"] = {
                "batch_number": batch_num,
                "quantity": qty,
                "customer_code": cust_code,
            }
            return {
                "intent_type": "record_dispatch_data",
                "confidence": 0.99,
                "goal": f"Record outward dispatch of {qty} units of Batch {batch_num} to customer {cust_code}",
                "requires_approval": True,
                "recommended_tools": ["verify_operational_invariants", "create_operational_record"],
                "entities": entities,
            }

        if any(term in p for term in ["issue recall", "declare recall", "new recall", "initiate recall"]):
            batch_num = entities.get("target_batch") or "B9900"
            sku = entities.get("products", ["PH-001"])[0] if entities.get("products") else "PH-001"
            cls_match = re.search(r"(class\s*(?:i{1,3}))", p)
            recall_cls = cls_match.group(1).title() if cls_match else "Class II"

            entities["record_type"] = "recall"
            entities["record_data"] = {
                "sku": sku,
                "batches": batch_num,
                "reason": prompt,
                "recall_class": recall_cls,
            }
            return {
                "intent_type": "issue_recall_data",
                "confidence": 0.99,
                "goal": f"Issue {recall_cls} recall for batch {batch_num} (SKU {sku}) and lock inventory",
                "requires_approval": True,
                "recommended_tools": ["verify_operational_invariants", "create_operational_record"],
                "entities": entities,
            }

        if any(term in p for term in ["add customer", "create customer", "register customer"]):
            entities["record_type"] = "customer"
            entities["record_data"] = {
                "name": prompt.replace("add customer", "").replace("create customer", "").strip() or "Apollo Clinic",
                "customer_type": "hospital" if "hospital" in p else "chemist",
                "location": "Bengaluru",
            }
            return {
                "intent_type": "add_customer_data",
                "confidence": 0.99,
                "goal": "Register new healthcare customer facility",
                "requires_approval": False,
                "recommended_tools": ["create_operational_record"],
                "entities": entities,
            }

        if any(term in p for term in ["add supplier", "create supplier", "register supplier"]):
            entities["record_type"] = "supplier"
            entities["record_data"] = {
                "name": prompt.replace("add supplier", "").replace("create supplier", "").strip() or "Sun Pharma Ltd",
                "sku": entities.get("products", ["PH-001"])[0] if entities.get("products") else "PH-001",
                "lead_time_days": 10,
                "min_order_quantity": 250,
            }
            return {
                "intent_type": "add_supplier_data",
                "confidence": 0.99,
                "goal": "Register new pharmaceutical supplier / manufacturer",
                "requires_approval": False,
                "recommended_tools": ["create_operational_record"],
                "entities": entities,
            }

        # -------------------------------------------------------------------
        # 1. Overdue Purchase Orders
        # "Which purchase orders are overdue?", "delayed purchase orders"
        # -------------------------------------------------------------------
        if ("overdue" in p and any(w in p for w in ["po", "order", "purchase", "delivery"])) or ("delayed po" in p) or ("delayed purchase" in p) or ("which purchase orders are overdue" in p) or ("overdue po" in p) or ("overdue order" in p):
            return {
                "intent_type": "overdue_purchase_orders",
                "confidence": 0.98,
                "goal": "Identify delayed and overdue purchase orders relative to business reference date",
                "requires_approval": False,
                "recommended_tools": ["get_overdue_purchase_orders"],
                "entities": entities,
            }

        # -------------------------------------------------------------------
        # 2. Dispatch Demand Analytics
        # "Which products have the highest dispatch demand?", "top dispatched products"
        # -------------------------------------------------------------------
        if (("highest" in p or "top" in p or "most" in p or "greatest" in p) and ("dispatch" in p or "demand" in p or "volume" in p or "sales" in p)) or ("dispatch analytics" in p) or ("demand pattern" in p):
            return {
                "intent_type": "dispatch_demand_analytics",
                "confidence": 0.98,
                "goal": "Analyze dispatch volumes, identify highest demand products and customer distribution patterns",
                "requires_approval": False,
                "recommended_tools": ["get_dispatch_demand_analytics"],
                "entities": entities,
            }

        # -------------------------------------------------------------------
        # 3. Recalled Stock Lookup across Warehouses
        # "Is any recalled stock still available in Bengaluru?"
        # -------------------------------------------------------------------
        if ("recalled" in p or "recall" in p) and ("available" in p or "still" in p or "stock" in p or "present" in p or "quarantine" in p) and any(w in p for w in ["bengaluru", "bangalore", "mysuru", "hubballi", "warehouse", "depot"]):
            wh_target = "Bengaluru" if ("bengaluru" in p or "bangalore" in p) else ("Mysuru" if "mysuru" in p else ("Hubballi" if "hubballi" in p else None))
            return {
                "intent_type": "recalled_stock_lookup",
                "confidence": 0.98,
                "goal": f"Check for presence of recalled batch stock in {wh_target or 'warehouses'} and verify quarantine isolation",
                "requires_approval": False,
                "recommended_tools": ["check_recalled_stock"],
                "entities": entities,
            }

        # -------------------------------------------------------------------
        # 4. Compare Insulin / Product Across Warehouses
        # "Compare insulin availability across all warehouses."
        # -------------------------------------------------------------------
        if ("compare" in p and ("across" in p or "warehouse" in p or "warehouses" in p or "depot" in p)) or ("insulin availability" in p) or ("availability across" in p):
            q_term = "insulin" if ("insulin" in p or "glargine" in p) else (entities.get("products", ["insulin"])[0] if entities.get("products") else "insulin")
            return {
                "intent_type": "warehouse_stock_comparison",
                "confidence": 0.98,
                "goal": f"Compare physical inventory distribution for {q_term} across all warehouse facilities",
                "requires_approval": False,
                "recommended_tools": ["compare_product_across_warehouses"],
                "entities": entities,
            }

        # -------------------------------------------------------------------
        # 5. Cold Rooms Outside Permitted Range
        # "Which cold rooms recorded temperatures outside the permitted range?"
        # -------------------------------------------------------------------
        if (("cold room" in p or "cold rooms" in p or "room" in p or "unit" in p or "facility" in p) and ("outside" in p or "permitted" in p or "range" in p or "limit" in p or "excursion" in p or "too warm" in p or "breach" in p)) or ("which cold rooms" in p):
            return {
                "intent_type": "cold_room_excursions",
                "confidence": 0.98,
                "goal": "Identify all cold rooms recording temperatures outside 2-8°C permitted range with excursion durations and affected inventory",
                "requires_approval": True,
                "recommended_tools": ["get_temperature_excursions"],
                "entities": entities,
            }

        # -------------------------------------------------------------------
        # 6. Replenishment Needs Before Next Delivery
        # "Can you identify products that need replenishment before the next delivery?"
        # -------------------------------------------------------------------
        if ("replenish" in p or "replenishment" in p) or ("need" in p and "delivery" in p and "before" in p) or ("need replenishment" in p):
            return {
                "intent_type": "replenishment_needs",
                "confidence": 0.96,
                "goal": "Identify products requiring replenishment before next delivery based on safety stock, burn rate, and supplier lead times",
                "requires_approval": True,
                "recommended_tools": ["get_replenishment_needs", "get_overdue_purchase_orders"],
                "entities": entities,
            }

        # -------------------------------------------------------------------
        # 7. Latest Recall Batches and Outward Dispatches
        # "Find the batches affected by the latest recall and check whether any were dispatched."
        # -------------------------------------------------------------------
        if (("latest" in p or "recent" in p or "last" in p) and ("recall" in p)) or (("batches affected" in p or "affected batches" in p) and ("dispatched" in p or "dispatch" in p)):
            return {
                "intent_type": "latest_recall_trace",
                "confidence": 0.98,
                "goal": "Identify batches affected by the latest recall and verify outward customer dispatches and remaining warehouse units",
                "requires_approval": True,
                "recommended_tools": ["get_latest_recall_dispatches", "trace_batch_recipients"],
                "entities": entities,
            }

        # -------------------------------------------------------------------
        # 8. Batches Expiring Within Next N Days (e.g., 60 days)
        # "Show all batches expiring within the next 60 days."
        # -------------------------------------------------------------------
        if ("expir" in p and ("within" in p or "next" in p or "horizon" in p or "days" in p or "show" in p)) or ("batches expiring" in p):
            days = entities.get("days_threshold") or 60
            return {
                "intent_type": "batches_expiring_horizon",
                "confidence": 0.98,
                "goal": f"Retrieve and audit all batches expiring within the next {days} days against burn rate and supplier RMA return cutoff",
                "requires_approval": True,
                "recommended_tools": ["get_expiry_risks_and_fefo"],
                "entities": entities,
            }

        # -------------------------------------------------------------------
        # 9. Critical Medicines at Risk of Running Out
        # "Which critical medicines are at risk of running out?"
        # -------------------------------------------------------------------
        if ("critical" in p and ("run out" in p or "running out" in p or "shortage" in p or "risk" in p or "depleted" in p or "stockout" in p)) or ("at risk of running out" in p):
            return {
                "intent_type": "critical_medicines_shortage",
                "confidence": 0.98,
                "goal": "Analyze all critical care medicines against safety stock thresholds, burn rate, and calculate stockout horizons",
                "requires_approval": True,
                "recommended_tools": ["calculate_shortage_risk", "get_supplier_information"],
                "entities": entities,
            }

        # -------------------------------------------------------------------
        # 10. Why is this Product Being Flagged as High Risk?
        # "Why is this product being flagged as high risk?"
        # -------------------------------------------------------------------
        if (("why is this" in p or "why is" in p or "reason" in p) and ("flagged" in p or "high risk" in p or "risk" in p)) or ("why flagged" in p):
            return {
                "intent_type": "risk_factor_explanation",
                "confidence": 0.98,
                "goal": "Explain converging operational risk factors (shortage, recall, temperature, expiry, delayed PO) for flagged product",
                "requires_approval": False,
                "recommended_tools": ["get_risk_factor_explanation"],
                "entities": entities,
            }

        # -------------------------------------------------------------------
        # 11. What Should I Prioritize Today and Why?
        # "What should I prioritize today, and why?" / Morning Triage
        # -------------------------------------------------------------------
        if any(term in p for term in ["prioritize", "priorities", "deal with first", "today", "morning", "triage", "what needs attention", "urgent issues"]):
            return {
                "intent_type": "what_needs_attention",
                "confidence": 0.98,
                "goal": "Prioritize operational exceptions across recalls, temperature excursions, critical shortages, and overdue POs",
                "requires_approval": False,
                "recommended_tools": ["get_attention_items"],
                "entities": entities,
            }

        # -------------------------------------------------------------------
        # 12. Explain Evidence Behind Recommendation
        # "Explain the evidence behind your recommendation."
        # -------------------------------------------------------------------
        if ("explain" in p and "evidence" in p) or ("evidence behind" in p) or ("audit trail" in p) or ("proof" in p and "recommendation" in p):
            return {
                "intent_type": "evidence_explanation",
                "confidence": 0.98,
                "goal": "Present complete multi-table database evidence, mathematical reconciliation, and regulatory compliance rules",
                "requires_approval": False,
                "recommended_tools": ["explain_evidence"],
                "entities": entities,
            }

        # 13. Traceability: "Show me everywhere batch B2231 went", "where did B2231 go"
        if any(term in p for term in ["everywhere", "where did", "went", "trace", "tracing", "recipients", "track batch", "distribution path"]) or ("where" in p and entities.get("target_batch")):
            return {
                "intent_type": "batch_traceability",
                "confidence": 0.95,
                "goal": f"Trace all outward customer dispatches and movements for batch {entities.get('target_batch') or 'specified'}",
                "requires_approval": False,
                "recommended_tools": ["trace_batch_recipients", "get_batch_movements", "get_inventory_by_batch"],
                "entities": entities,
            }

        # 14. Cold chain investigation general
        if any(term in p for term in ["temperature", "cold room", "cold-chain", "cold chain", "too warm", "excursion", "thermal", "sensor", "refrigerat"]):
            return {
                "intent_type": "cold_chain_investigation",
                "confidence": 0.96,
                "goal": "Investigate temperature excursions, map batches stored during excursion interval, and quantify affected biologicals",
                "requires_approval": True,
                "recommended_tools": ["get_temperature_excursions", "get_inventory_by_batch"],
                "entities": entities,
            }

        # 15. Replacement coverage: "Can the replacement batch cover the recall and our normal demand?"
        if any(term in p for term in ["replacement batch", "cover the recall", "cover both", "cover normal demand", "replacement coverage", "can replacement cover"]):
            return {
                "intent_type": "replacement_coverage",
                "confidence": 0.96,
                "goal": "Calculate replacement stock availability against recall demand and forecast lead-time normal demand",
                "requires_approval": True,
                "recommended_tools": ["calculate_replacement_coverage", "compare_operational_options"],
                "entities": entities,
            }

        # 16. Supplier return deadlines: "Which supplier returns must we arrange this week?"
        if any(term in p for term in ["supplier return", "return window", "rma", "credit deadline", "supplier returns", "return to vendor"]):
            return {
                "intent_type": "supplier_returns",
                "confidence": 0.95,
                "goal": "Calculate supplier return window eligibility and identify batches approaching return cutoff",
                "requires_approval": True,
                "recommended_tools": ["get_expiry_risks_and_fefo", "calculate_supplier_return_window"],
                "entities": entities,
            }

        # 17. Expiry general: "Are any medicines likely to expire before we can sell them?"
        if any(term in p for term in ["expire", "expiry", "fefo", "shelf life", "sell before", "outdated"]):
            return {
                "intent_type": "expiry_risk",
                "confidence": 0.94,
                "goal": "Identify near-expiry inventory, estimate sell-through risk against demand burn rate, and check FEFO compliance",
                "requires_approval": True,
                "recommended_tools": ["get_expiry_risks_and_fefo", "calculate_supplier_return_window"],
                "entities": entities,
            }

        # 18. Shortage general
        if any(term in p for term in ["shortage", "stockout", "depleted", "days of cover", "safety stock", "run out"]):
            return {
                "intent_type": "shortage_risk",
                "confidence": 0.95,
                "goal": "Evaluate critical medicine inventory against safety stock and lead-time consumption to calculate stockout horizon",
                "requires_approval": True,
                "recommended_tools": ["calculate_shortage_risk", "get_supplier_information"],
                "entities": entities,
            }

        # 19. Decision comparison
        if any(term in p for term in ["compare", "comparison", "alternative", "option", "tradeoff", "versus", " vs "]):
            return {
                "intent_type": "decision_comparison",
                "confidence": 0.95,
                "goal": "Compare feasible operational options with quantitative criteria (coverage, lead time, disruption, risk)",
                "requires_approval": True,
                "recommended_tools": ["compare_operational_options"],
                "entities": entities,
            }

        # 20. Draft Purchase Order
        if any(term in p for term in ["purchase order", "draft po", "draft an urgent po", "place order", "reorder"]):
            return {
                "intent_type": "draft_purchase_order",
                "confidence": 0.94,
                "goal": "Draft an emergency purchase order respecting supplier minimum order quantity (MOQ) and lead time",
                "requires_approval": True,
                "recommended_tools": ["calculate_shortage_risk", "get_supplier_information", "create_action_proposal"],
                "entities": entities,
            }

        # 21. Pending Approvals
        if any(term in p for term in ["waiting for my approval", "pending approval", "awaiting approval", "pending actions"]):
            return {
                "intent_type": "pending_approvals",
                "confidence": 0.98,
                "goal": "Retrieve all action proposals awaiting Qualified Person authorization",
                "requires_approval": False,
                "recommended_tools": ["get_pending_approvals"],
                "entities": entities,
            }

        # 22. Recall management general
        if any(term in p for term in ["recall", "recalled", "containment", "advisory", "freeze"]):
            return {
                "intent_type": "recall_management",
                "confidence": 0.95,
                "goal": "Execute end-to-end recall investigation: isolate warehouse stock, trace all recipients, calculate replacement deficit, stage proposals",
                "requires_approval": True,
                "recommended_tools": [
                    "get_inventory_by_batch",
                    "get_batch_movements",
                    "trace_batch_recipients",
                    "calculate_replacement_coverage",
                    "compare_operational_options",
                    "get_supplier_information",
                    "verify_operational_invariants",
                    "create_action_proposal",
                ],
                "entities": entities,
            }

        # 23. Batch investigation
        if entities.get("target_batch"):
            return {
                "intent_type": "batch_investigation",
                "confidence": 0.92,
                "goal": f"Investigate batch {entities['target_batch']} inventory status, storage, movements, and recipient trace",
                "requires_approval": False,
                "recommended_tools": ["get_inventory_by_batch", "get_batch_movements", "trace_batch_recipients"],
                "entities": entities,
            }

        # Default fallback
        return {
            "intent_type": "what_needs_attention",
            "confidence": 0.80,
            "goal": "Analyze operational state and summarize critical inventory priorities",
            "requires_approval": False,
            "recommended_tools": ["get_attention_items"],
            "entities": entities,
        }
