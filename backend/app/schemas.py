from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field


def utcnow_str() -> str:
    return datetime.now(timezone.utc).isoformat()


# ---------------------------------------------------------------------------
# Dashboard & Attention Items
# ---------------------------------------------------------------------------
class AttentionItem(BaseModel):
    id: str
    priority: str  # critical, high, medium
    category: str  # recall, expiry, cold_chain, shortage
    title: str
    description: str
    batch_number: Optional[str] = None
    action_prompt: str


class DashboardSummaryResponse(BaseModel):
    total_products: int
    total_batches: int
    active_alerts: int
    batches_near_expiry: int
    active_recalls: int
    cold_chain_exceptions: int
    pending_approvals: int
    attention_items: List[AttentionItem]
    timestamp: str = Field(default_factory=utcnow_str)


# ---------------------------------------------------------------------------
# Inventory Schemas
# ---------------------------------------------------------------------------
class ProductSchema(BaseModel):
    id: int
    sku: str
    name: str
    molecule: str
    brand: str
    category: str
    storage_range: str
    is_critical: bool
    unit_price: float
    unit_of_measure: str
    min_safety_stock: int

    model_config = ConfigDict(from_attributes=True)


class BatchSummarySchema(BaseModel):
    id: int
    batch_number: str
    product_id: int
    product_name: str
    product_sku: str
    warehouse_code: str
    warehouse_name: str
    available_quantity: int
    initial_quantity: int
    manufacturing_date: str
    expiry_date: str
    status: str
    storage_condition: str
    days_to_expiry: int

    model_config = ConfigDict(from_attributes=True)


class MovementSchema(BaseModel):
    id: int
    movement_type: str
    quantity: int
    reference_doc: str
    timestamp: str
    notes: Optional[str] = None


class DispatchSchema(BaseModel):
    id: int
    dispatch_number: str
    customer_name: str
    customer_type: str
    quantity: int
    dispatch_date: str
    status: str
    tracking_ref: Optional[str] = None


class BatchDetailSchema(BaseModel):
    batch: BatchSummarySchema
    product: ProductSchema
    movements: List[MovementSchema]
    dispatches: List[DispatchSchema]
    total_dispatched: int


# ---------------------------------------------------------------------------
# Action Proposals & Approvals
# ---------------------------------------------------------------------------
class ApprovalDecisionRequest(BaseModel):
    decision: str = Field(..., description="'approved' or 'rejected'")
    approver_role: str = Field(..., description="E.g., Lead Pharmacist, QA Compliance Officer")
    approver_name: str = Field(default="Dr. Ananya Sharma, R.Ph")
    notes: Optional[str] = Field(default="Approved after reviewing audit trail and trace records.")


class ActionProposalSchema(BaseModel):
    id: int
    run_id: str
    incident_id: Optional[int] = None
    action_type: str
    title: str
    description: str
    rationale: str
    supporting_evidence: Optional[Dict[str, Any]] = None
    target_entity: str
    expected_impact: str
    status: str
    created_at: str
    approved_by: Optional[str] = None
    approved_at: Optional[str] = None
    rejection_reason: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# Agent Workflow & Live Events
# ---------------------------------------------------------------------------
class AgentTaskRequest(BaseModel):
    prompt: str = Field(..., min_length=3, description="Task prompt or problem statement")
    mode: str = Field(default="demo", description="'demo' or 'live'")
    incident_id: Optional[int] = None


class AgentEventSchema(BaseModel):
    step_number: int
    stage: str
    event_type: str
    tool_name: Optional[str] = None
    message: str
    data: Optional[Dict[str, Any]] = None
    timestamp: str = Field(default_factory=utcnow_str)


class VerificationCheck(BaseModel):
    check_name: str
    rule_description: str
    status: str  # passed, failed, warning
    computed_value: Any
    expected_value: Any
    is_valid: bool
    details: str


class ResponseOption(BaseModel):
    option_id: str
    title: str
    allocation_plan: str
    shortage_mitigation: str
    lead_time_impact: str
    pros: List[str]
    cons: List[str]
    is_recommended: bool


class FinalReportSchema(BaseModel):
    incident_summary: str
    facts_retrieved: Dict[str, Any]
    affected_batches: List[str]
    total_recipients: int
    quantities_reconciled: Dict[str, Any]
    alternatives_compared: List[ResponseOption]
    recommendation: str
    assumptions_and_limits: List[str]
    verification_results: List[VerificationCheck]
    proposed_actions_count: int
    approval_required: bool


class AgentRunDetailSchema(BaseModel):
    run_id: str
    prompt: str
    state: str
    current_step: int
    created_at: str
    completed_at: Optional[str] = None
    events: List[AgentEventSchema]
    plan: Optional[List[Dict[str, Any]]] = None
    evidence: Optional[Dict[str, Any]] = None
    verification: Optional[Any] = None
    final_report: Optional[FinalReportSchema] = None
    proposals: List[ActionProposalSchema] = []
