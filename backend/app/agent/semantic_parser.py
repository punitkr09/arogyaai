import json
import logging
import re
from typing import Any, Dict, List, Optional
from app.agent.ai_provider import BaseAIProvider

logger = logging.getLogger(__name__)


class SemanticRequestParser:
    """Interprets natural-language operations requests semantically into structured intent,
    entities, required tools, constraints, and operational goals.
    """

    KNOWN_BATCHES = ["B2231", "B2240", "B1982", "B4019", "B3102", "B5011", "B7033"]
    KNOWN_PRODUCTS = {
        "amoxicillin": "MED-AMX-625",
        "augmax": "MED-AMX-625",
        "ceftriaxone": "MED-CEF-1000",
        "monoceft": "MED-CEF-1000",
        "insulin": "MED-INS-100",
        "glargine": "MED-INS-100",
        "glaritus": "MED-INS-100",
        "meropenem": "MED-MER-1000",
        "meronext": "MED-MER-1000",
        "paracetamol": "MED-PCM-650",
        "dolo": "MED-PCM-650",
        "pantoprazole": "MED-PAN-040",
        "pan-40": "MED-PAN-040",
    }
    KNOWN_WAREHOUSES = {
        "central": "WH-CENTRAL",
        "bhiwandi": "WH-CENTRAL",
        "north": "WH-NORTH",
        "ncr": "WH-NORTH",
        "west": "WH-WEST",
        "pune": "WH-WEST",
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
                logger.warning(f"LLM classification bypassed: {str(e)}")
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
            "quantity": None,
            "days_threshold": None,
            "target_batch": None,
            "replacement_batch": None,
        }

        # 1. Batches (Pattern: B followed by 4 digits)
        matches = re.findall(r"\b([A-Za-z]\d{4})\b", prompt)
        for m in matches:
            b_norm = m.upper()
            if b_norm not in extracted["batches"]:
                extracted["batches"].append(b_norm)

        # If context has a recent batch and none found, check context
        if not extracted["batches"] and context and context.get("target_batch"):
            extracted["batches"].append(context["target_batch"])

        if extracted["batches"]:
            extracted["target_batch"] = extracted["batches"][0]
            if len(extracted["batches"]) > 1:
                extracted["replacement_batch"] = extracted["batches"][1]

        # 2. Products
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

        # 5. Quantity / numbers
        qty_matches = re.findall(r"\b(\d+)\s*(?:units?|doses?|boxes?|packs?)\b", p_lower)
        if qty_matches:
            try:
                extracted["quantity"] = int(qty_matches[0])
            except ValueError:
                pass

        # 6. Days threshold
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
            "['what_needs_attention', 'batch_traceability', 'batch_investigation', 'expiry_risk', "
            "'supplier_returns', 'cold_chain_investigation', 'recall_management', 'replacement_coverage', "
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
            timeout=8.0,
        )

        content = res.get("content", "").strip()
        # Parse JSON
        if content.startswith("```"):
            content = re.sub(r"^```(?:json)?\n", "", content)
            content = re.sub(r"\n```$", "", content)

        data = json.loads(content)
        return data

    def _validate_llm_intent(self, intent: Dict[str, Any]) -> bool:
        valid_intents = [
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
                    "This question falls outside pharmaceutical supply-chain operations."
                ),
            }

        # 1. "What should I deal with first this morning?" / Attention / Triage
        if any(term in p for term in ["deal with first", "attention", "today", "morning", "triage", "priorities", "overview", "what needs attention", "urgent issues"]):
            return {
                "intent_type": "what_needs_attention",
                "confidence": 0.98,
                "goal": "Retrieve and prioritize all operational exceptions across recalls, cold-chain, expiry, and shortages",
                "requires_approval": False,
                "recommended_tools": ["get_attention_items"],
                "entities": entities,
            }

        # 2. Traceability: "Show me everywhere batch B2231 went", "where did B2231 go", "recipients of B2231"
        if any(term in p for term in ["everywhere", "where did", "went", "trace", "tracing", "recipients", "track batch", "distribution path"]) or ("where" in p and entities.get("target_batch")):
            return {
                "intent_type": "batch_traceability",
                "confidence": 0.95,
                "goal": f"Trace all outward customer dispatches and movements for batch {entities.get('target_batch') or 'specified'}",
                "requires_approval": False,
                "recommended_tools": ["trace_batch_recipients", "get_batch_movements", "get_inventory_by_batch"],
                "entities": entities,
            }

        # 3. Cold chain: "Which batches are at risk because their cold room became too warm?", "temperature", "cold room", "excursion", "thermal"
        if any(term in p for term in ["temperature", "cold room", "cold-chain", "cold chain", "too warm", "excursion", "thermal", "sensor", "refrigerat"]):
            return {
                "intent_type": "cold_chain_investigation",
                "confidence": 0.96,
                "goal": "Investigate temperature excursions, map batches stored during excursion interval, and quantify affected biologicals",
                "requires_approval": True,
                "recommended_tools": ["get_temperature_excursions", "get_inventory_by_batch"],
                "entities": entities,
            }

        # 4. Replacement coverage: "Can the replacement batch cover the recall and our normal demand?"
        if any(term in p for term in ["replacement batch", "cover the recall", "cover both", "cover normal demand", "replacement coverage", "can replacement cover"]):
            return {
                "intent_type": "replacement_coverage",
                "confidence": 0.96,
                "goal": "Calculate replacement stock availability against recall demand and forecast lead-time normal demand",
                "requires_approval": True,
                "recommended_tools": ["calculate_replacement_coverage", "compare_operational_options"],
                "entities": entities,
            }

        # 5. Supplier return deadlines: "Which supplier returns must we arrange this week?", "return window", "rma"
        if any(term in p for term in ["supplier return", "return window", "rma", "credit deadline", "supplier returns", "return to vendor"]):
            return {
                "intent_type": "supplier_returns",
                "confidence": 0.95,
                "goal": "Calculate supplier return window eligibility and identify batches approaching return cutoff",
                "requires_approval": True,
                "recommended_tools": ["get_expiry_risks_and_fefo", "calculate_supplier_return_window"],
                "entities": entities,
            }

        # 6. Expiry / FEFO: "Are any medicines likely to expire before we can sell them?", "expire", "expiry", "fefo", "shelf life"
        if any(term in p for term in ["expire", "expiry", "fefo", "shelf life", "sell before", "outdated"]):
            return {
                "intent_type": "expiry_risk",
                "confidence": 0.94,
                "goal": "Identify near-expiry inventory, estimate sell-through risk against demand burn rate, and check FEFO compliance",
                "requires_approval": True,
                "recommended_tools": ["get_expiry_risks_and_fefo", "calculate_supplier_return_window"],
                "entities": entities,
            }

        # 7. Shortage: "Why is this medicine showing as a shortage risk?", "shortage", "stockout", "depleted", "days of cover", "run out"
        if any(term in p for term in ["shortage", "stockout", "depleted", "days of cover", "safety stock", "run out"]):
            return {
                "intent_type": "shortage_risk",
                "confidence": 0.95,
                "goal": "Evaluate critical medicine inventory against safety stock and lead-time consumption to calculate stockout horizon",
                "requires_approval": True,
                "recommended_tools": ["calculate_shortage_risk", "get_supplier_information"],
                "entities": entities,
            }

        # 8. Decision comparison: "Compare returning this stock with transferring it to another warehouse", "compare"
        if any(term in p for term in ["compare", "comparison", "alternative", "option", "tradeoff", "versus", " vs "]):
            return {
                "intent_type": "decision_comparison",
                "confidence": 0.95,
                "goal": "Compare feasible operational options with quantitative criteria (coverage, lead time, disruption, risk)",
                "requires_approval": True,
                "recommended_tools": ["compare_operational_options"],
                "entities": entities,
            }

        # 9. Draft Purchase Order: "Draft an urgent purchase order", "order replacement", "place po"
        if any(term in p for term in ["purchase order", "draft po", "draft an urgent po", "place order", "reorder", "replenish"]):
            return {
                "intent_type": "draft_purchase_order",
                "confidence": 0.94,
                "goal": "Draft an emergency purchase order respecting supplier minimum order quantity (MOQ) and lead time",
                "requires_approval": True,
                "recommended_tools": ["calculate_shortage_risk", "get_supplier_information", "create_action_proposal"],
                "entities": entities,
            }

        # 10. Pending Approvals: "What actions are waiting for my approval?", "pending approval"
        if any(term in p for term in ["waiting for my approval", "pending approval", "awaiting approval", "pending actions"]):
            return {
                "intent_type": "pending_approvals",
                "confidence": 0.98,
                "goal": "Retrieve all action proposals awaiting Qualified Person authorization",
                "requires_approval": False,
                "recommended_tools": ["get_pending_approvals"],
                "entities": entities,
            }

        # 11. Recall: "recall", "b2231", "recalled", "class ii"
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

        # 12. Batch investigation: specific batch mentioned
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
