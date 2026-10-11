from datetime import datetime, timezone
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import relationship
from app.database import Base


def utcnow():
    return datetime.now(timezone.utc)


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    sku = Column(String(64), unique=True, index=True, nullable=False)
    name = Column(String(255), nullable=False)
    molecule = Column(String(255), nullable=False)
    brand = Column(String(128), nullable=False)
    category = Column(String(64), nullable=False)  # Antibiotic, Biological, Critical Care, Analgesic
    storage_range = Column(String(64), default="15°C - 25°C")
    is_critical = Column(Boolean, default=False)
    unit_price = Column(Float, default=0.0)
    unit_of_measure = Column(String(32), default="unit")
    min_safety_stock = Column(Integer, default=100)

    batches = relationship("BatchInventory", back_populates="product", cascade="all, delete-orphan")
    dispatches = relationship("Dispatch", back_populates="product")
    purchase_orders = relationship("PurchaseOrder", back_populates="product")


class Warehouse(Base):
    __tablename__ = "warehouses"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(32), unique=True, index=True, nullable=False)
    name = Column(String(128), nullable=False)
    location = Column(String(255), nullable=False)
    cold_storage_available = Column(Boolean, default=False)

    batches = relationship("BatchInventory", back_populates="warehouse")
    temperature_logs = relationship("TemperatureLog", back_populates="warehouse")


class BatchInventory(Base):
    __tablename__ = "batch_inventories"

    id = Column(Integer, primary_key=True, index=True)
    batch_number = Column(String(64), index=True, nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    warehouse_id = Column(Integer, ForeignKey("warehouses.id"), nullable=False)
    storage_location = Column(String(64), default="AMB")
    available_quantity = Column(Integer, nullable=False, default=0)
    initial_quantity = Column(Integer, nullable=False, default=0)
    manufacturing_date = Column(DateTime, nullable=False)
    expiry_date = Column(DateTime, nullable=False)
    status = Column(String(32), default="active")  # active, quarantine, dispatch_hold, recalled
    storage_condition = Column(String(64), default="Controlled Room Temp (15-25°C)")

    product = relationship("Product", back_populates="batches")
    warehouse = relationship("Warehouse", back_populates="batches")
    movements = relationship("StockMovement", back_populates="batch", cascade="all, delete-orphan")
    dispatches = relationship("Dispatch", back_populates="batch")


class StockMovement(Base):
    __tablename__ = "stock_movements"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("batch_inventories.id"), nullable=False)
    movement_type = Column(String(32), nullable=False)  # receipt, dispatch, quarantine_hold, release, adjustment
    quantity = Column(Integer, nullable=False)
    reference_doc = Column(String(128), nullable=False)
    timestamp = Column(DateTime, default=utcnow)
    notes = Column(Text, nullable=True)

    batch = relationship("BatchInventory", back_populates="movements")


class Customer(Base):
    __tablename__ = "customers"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(32), unique=True, index=True, nullable=False)
    name = Column(String(255), nullable=False)
    customer_type = Column(String(32), nullable=False)  # chemist, hospital
    location = Column(String(128), nullable=True)
    credit_terms = Column(String(64), nullable=True)
    contact_email = Column(String(128), nullable=True)
    phone = Column(String(32), nullable=True)
    address = Column(String(255), nullable=True)
    license_number = Column(String(64), nullable=True)
    compliance_verified = Column(Boolean, default=True)
    priority_tier = Column(Integer, default=2)  # 1: Emergency/Hospital, 2: Standard Retail/Chemist

    dispatches = relationship("Dispatch", back_populates="customer")


class Dispatch(Base):
    __tablename__ = "dispatches"

    id = Column(Integer, primary_key=True, index=True)
    dispatch_number = Column(String(64), unique=True, index=True, nullable=False)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False)
    batch_id = Column(Integer, ForeignKey("batch_inventories.id"), nullable=True)
    batch_number = Column(String(64), index=True, nullable=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    sku = Column(String(64), index=True, nullable=True)
    quantity = Column(Integer, nullable=False)
    dispatch_date = Column(DateTime, nullable=False, index=True)
    status = Column(String(32), default="delivered")  # delivered, in_transit
    tracking_ref = Column(String(64), nullable=True)

    customer = relationship("Customer", back_populates="dispatches")
    batch = relationship("BatchInventory", back_populates="dispatches")
    product = relationship("Product", back_populates="dispatches")


class Supplier(Base):
    __tablename__ = "suppliers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    sku = Column(String(64), index=True, nullable=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=True)
    contact_email = Column(String(128), nullable=True)
    phone = Column(String(32), nullable=True)
    lead_time_days = Column(Integer, default=14)
    min_order_quantity = Column(Integer, default=500)
    return_window_days = Column(Integer, default=60)  # Days prior to expiry allowed for return

    product = relationship("Product", foreign_keys=[product_id])
    purchase_orders = relationship("PurchaseOrder", back_populates="supplier")


class PurchaseOrder(Base):
    __tablename__ = "purchase_orders"

    id = Column(Integer, primary_key=True, index=True)
    po_number = Column(String(64), unique=True, index=True, nullable=False)
    supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    manufacturer = Column(String(128), nullable=True)
    sku = Column(String(64), index=True, nullable=True)
    quantity = Column(Integer, nullable=False)
    unit_price = Column(Float, default=0.0)
    total_amount = Column(Float, default=0.0)
    status = Column(String(64), default="draft")  # draft, submitted, approved, fulfilled, Confirmed, Received, Open, Delayed
    urgency = Column(String(32), default="routine")  # routine, urgent, emergency
    notes = Column(Text, nullable=True)
    order_date = Column(DateTime, default=utcnow)
    expected_delivery_date = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=utcnow)

    supplier = relationship("Supplier", back_populates="purchase_orders")
    product = relationship("Product", back_populates="purchase_orders")


class Recall(Base):
    __tablename__ = "recalls"

    id = Column(Integer, primary_key=True, index=True)
    recall_date = Column(DateTime, nullable=False, index=True)
    sku = Column(String(64), index=True, nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=True)
    batches = Column(String(255), nullable=False)  # affected batch(es), e.g. "B2231"
    reason = Column(Text, nullable=False)
    recall_class = Column(String(32), nullable=False)  # Class I, Class II, Class III
    status = Column(String(32), default="active")  # active, completed, closed

    product = relationship("Product", foreign_keys=[product_id])

    @property
    def batch_number(self) -> str:
        return self.batches

    @property
    def classification(self) -> str:
        return self.recall_class


class TemperatureLog(Base):
    __tablename__ = "temperature_logs"

    id = Column(Integer, primary_key=True, index=True)
    warehouse_id = Column(Integer, ForeignKey("warehouses.id"), nullable=False)
    warehouse_name = Column(String(128), nullable=True)
    cold_room_unit = Column(String(64), nullable=False)
    recorded_at = Column(DateTime, default=utcnow, index=True)
    temperature_celsius = Column(Float, nullable=False)
    is_excursion = Column(Boolean, default=False)
    duration_minutes = Column(Integer, default=0)
    alert_sent = Column(Boolean, default=False)
    permitted_range = Column(String(32), default="2°C - 8°C")
    thermal_severity = Column(String(32), default="Normal")
    notes = Column(Text, nullable=True)

    warehouse = relationship("Warehouse", back_populates="temperature_logs")

    @property
    def recorded_temperature_celsius(self):
        return self.temperature_celsius


class Incident(Base):
    __tablename__ = "incidents"

    id = Column(Integer, primary_key=True, index=True)
    incident_number = Column(String(64), unique=True, index=True, nullable=False)
    title = Column(String(255), nullable=False)
    incident_type = Column(String(32), nullable=False)  # recall, expiry_risk, temperature_excursion, shortage
    severity = Column(String(32), default="medium")  # critical, high, medium, low
    affected_batch_number = Column(String(64), nullable=True)
    status = Column(String(32), default="open")  # open, investigating, contained, resolved
    details_json = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utcnow)

    proposals = relationship("ActionProposal", back_populates="incident")


class AgentRun(Base):
    __tablename__ = "agent_runs"

    id = Column(String(64), primary_key=True, index=True)
    prompt = Column(Text, nullable=False)
    incident_id = Column(Integer, ForeignKey("incidents.id"), nullable=True)
    state = Column(String(32), default="queued")  # queued, intake, planning, executing, analyzing, verifying, awaiting_approval, completed, failed
    intent_json = Column(Text, nullable=True)
    plan_json = Column(Text, nullable=True)
    current_step = Column(Integer, default=0)
    evidence_json = Column(Text, nullable=True)
    verification_json = Column(Text, nullable=True)
    recommendation_json = Column(Text, nullable=True)
    final_report_json = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utcnow)
    completed_at = Column(DateTime, nullable=True)

    events = relationship("AgentEvent", back_populates="run", cascade="all, delete-orphan")
    proposals = relationship("ActionProposal", back_populates="run", cascade="all, delete-orphan")


class AgentEvent(Base):
    __tablename__ = "agent_events"

    id = Column(Integer, primary_key=True, index=True)
    run_id = Column(String(64), ForeignKey("agent_runs.id"), nullable=False)
    step_number = Column(Integer, default=0)
    stage = Column(String(32), nullable=False)  # intake, planning, execution, analysis, verification, approval, reporting
    event_type = Column(String(32), nullable=False)  # plan, tool_call, tool_result, verification, state_change, warning, info
    tool_name = Column(String(64), nullable=True)
    message = Column(String(512), nullable=False)
    data_json = Column(Text, nullable=True)
    timestamp = Column(DateTime, default=utcnow)

    run = relationship("AgentRun", back_populates="events")


class ActionProposal(Base):
    __tablename__ = "action_proposals"

    id = Column(Integer, primary_key=True, index=True)
    run_id = Column(String(64), ForeignKey("agent_runs.id"), nullable=False)
    incident_id = Column(Integer, ForeignKey("incidents.id"), nullable=True)
    action_type = Column(String(64), nullable=False)  # dispatch_hold, quarantine_order, customer_notice, purchase_order, stock_allocation
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    rationale = Column(Text, nullable=False)
    supporting_evidence = Column(Text, nullable=True)  # JSON
    target_entity = Column(String(255), nullable=False)
    expected_impact = Column(String(255), nullable=False)
    status = Column(String(32), default="pending_review")  # pending_review, approved, rejected
    created_at = Column(DateTime, default=utcnow)
    approved_by = Column(String(128), nullable=True)
    approved_at = Column(DateTime, nullable=True)
    rejection_reason = Column(Text, nullable=True)

    run = relationship("AgentRun", back_populates="proposals")
    incident = relationship("Incident", back_populates="proposals")
    decisions = relationship("ApprovalDecision", back_populates="proposal", cascade="all, delete-orphan")


class ApprovalDecision(Base):
    __tablename__ = "approval_decisions"

    id = Column(Integer, primary_key=True, index=True)
    proposal_id = Column(Integer, ForeignKey("action_proposals.id"), nullable=False)
    decision = Column(String(32), nullable=False)  # approved, rejected
    approver_role = Column(String(64), nullable=False)  # Lead Pharmacist, QA Compliance Officer, Operations Director
    approver_name = Column(String(128), nullable=False)
    notes = Column(Text, nullable=True)
    timestamp = Column(DateTime, default=utcnow)

    proposal = relationship("ActionProposal", back_populates="decisions")
