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


class CreateDispatchRequest(BaseModel):
    batch_number: str = Field(..., description="Batch number to dispatch from")
    customer_code: str = Field(..., description="Customer receiving stock")
    quantity: int = Field(..., gt=0, description="Number of units to dispatch")
    notes: Optional[str] = None


class TraceabilityResponse(BaseModel):
    batch_number: str
    product_name: str
    product_sku: str
    remaining_warehouse_stock: int
    total_dispatched_quantity: int
    total_recipients_count: int
    breakdown: Dict[str, Any]
    recipients: List[Dict[str, Any]]


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


# ---------------------------------------------------------------------------
# Create & Update Schemas for Operational Entity Management
# ---------------------------------------------------------------------------
class CreateBatchRequest(BaseModel):
    batch_number: str
    product_id: int
    warehouse_id: int
    available_quantity: int
    initial_quantity: Optional[int] = None
    manufacturing_date: Optional[str] = None
    expiry_date: str
    status: str = "active"  # active, dispatch_hold, quarantine, recalled
    storage_condition: str = "Controlled Room Temp (15-25°C)"


class UpdateBatchRequest(BaseModel):
    available_quantity: Optional[int] = None
    status: Optional[str] = None
    warehouse_id: Optional[int] = None
    expiry_date: Optional[str] = None
    storage_condition: Optional[str] = None


class CreateProductRequest(BaseModel):
    sku: str
    name: str
    molecule: str
    brand: str
    category: str
    storage_range: str = "15°C - 25°C"
    is_critical: bool = False
    unit_price: float = 0.0
    unit_of_measure: str = "Pack of 10"
    min_safety_stock: int = 100


class UpdateProductRequest(BaseModel):
    name: Optional[str] = None
    molecule: Optional[str] = None
    brand: Optional[str] = None
    category: Optional[str] = None
    storage_range: Optional[str] = None
    is_critical: Optional[bool] = None
    unit_price: Optional[float] = None
    unit_of_measure: Optional[str] = None
    min_safety_stock: Optional[int] = None


class CustomerSchema(BaseModel):
    id: int
    code: str
    name: str
    customer_type: str
    priority_tier: int
    contact_email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class CreateCustomerRequest(BaseModel):
    code: str
    name: str
    customer_type: str  # hospital, chemist
    priority_tier: int = 2  # 1 for hospital/critical, 2 for retail
    contact_email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None


class UpdateCustomerRequest(BaseModel):
    name: Optional[str] = None
    customer_type: Optional[str] = None
    priority_tier: Optional[int] = None
    contact_email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None


class WarehouseSchema(BaseModel):
    id: int
    code: str
    name: str
    location: str
    cold_storage_available: bool

    model_config = ConfigDict(from_attributes=True)


class CreateWarehouseRequest(BaseModel):
    code: str
    name: str
    location: str
    cold_storage_available: bool = False


class TemperatureLogSchema(BaseModel):
    id: int
    warehouse_id: int
    warehouse_name: str
    cold_room_unit: str
    recorded_at: str
    recorded_temperature_celsius: float
    permitted_range: str
    duration_minutes: int
    thermal_severity: str
    notes: Optional[str] = None


class CreateTemperatureLogRequest(BaseModel):
    warehouse_id: int
    cold_room_unit: str
    recorded_temperature_celsius: float
    permitted_range: str = "2°C - 8°C"
    duration_minutes: int = 0
    thermal_severity: str = "Normal"  # Normal, Critical, Warning
    notes: Optional[str] = None


class PurchaseOrderSchema(BaseModel):
    id: int
    po_number: str
    product_name: str
    product_sku: str
    supplier_name: str
    quantity: int
    unit_price: float
    total_amount: float
    status: str
    order_date: str
    expected_delivery_date: Optional[str] = None
    notes: Optional[str] = None


class CreatePurchaseOrderRequest(BaseModel):
    product_id: int
    supplier_id: Optional[int] = None
    quantity: int
    unit_price: Optional[float] = None
    notes: Optional[str] = None


class UpdatePurchaseOrderStatusRequest(BaseModel):
    status: str
    notes: Optional[str] = None


class CreateCustomProposalRequest(BaseModel):
    action_type: str  # dispatch_hold, quarantine_order, purchase_order, vendor_return_rma, customer_notice
    title: str
    description: str
    rationale: str
    target_entity: str
    expected_impact: str


class UpdateProposalRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    rationale: Optional[str] = None
    expected_impact: Optional[str] = None

