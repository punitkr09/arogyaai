export interface AttentionItem {
  id: string
  priority: 'critical' | 'high' | 'medium'
  category: 'recall' | 'expiry' | 'cold_chain' | 'shortage'
  title: string
  description: string
  batch_number?: string
  action_prompt: string
}

export interface DashboardSummary {
  total_products: number
  total_batches: number
  active_alerts: number
  batches_near_expiry: number
  active_recalls: number
  cold_chain_exceptions: number
  pending_approvals: number
  attention_items: AttentionItem[]
  timestamp: string
  total_customers?: number
  total_inventory_units?: number
  total_dispatches?: number
  total_dispatched_units?: number
  critical_drugs_count?: number
  low_stock_products_count?: number
  delayed_purchase_orders?: number
  overdue_purchase_orders?: number
  business_reference_date?: string
  warehouse_distribution?: Record<string, number>
}

export interface Supplier {
  id: number
  name: string
  sku?: string
  product_id?: number
  contact_email?: string
  phone?: string
  lead_time_days: number
  min_order_quantity: number
  return_window_days: number
  product?: Product
}

export interface Dispatch {
  id: number
  dispatch_number: string
  customer_id?: number
  batch_id?: number
  product_id?: number
  batch_number?: string
  sku?: string
  quantity: number
  dispatch_date: string
  status: string
  tracking_ref?: string
  customer_name?: string
  customer_type?: string
  customer_code?: string
  customer_location?: string
  product_name?: string
  is_critical_drug?: boolean
  customer?: Customer
  product?: Product
  batch?: BatchSummary
}

export interface Recall {
  id: number
  recall_date: string
  sku: string
  product_id?: number
  product_name?: string
  batches: string
  batch_number?: string
  reason: string
  recall_class: string
  classification?: string
  status: string
  product?: Product
  affected_batches?: string[]
  remaining_warehouse_stock?: number
  dispatched_units?: number
  dispatches_count?: number
}

export interface AnalyticsOverview {
  total_dispatches: number
  total_quantity: number
  total_units_dispatched?: number
  unique_products: number
  unique_customers: number
  top_products_by_volume: Array<{ sku: string; name: string; brand: string; quantity: number; dispatches_count: number }>
  customer_segmentation: Array<{ segment: string; quantity: number; dispatches_count: number; percent: number }>
  warehouse_distribution: Array<{ warehouse: string; quantity: number; dispatches_count: number }>
  daily_trend: Array<{ date: string; quantity: number; dispatches_count: number }>
  daily_trends?: Array<{ date: string; orders: number; quantity: number }>
  top_locations?: Array<{ location: string; quantity: number; orders: number }>
}


export interface Product {
  id: number
  sku: string
  name: string
  molecule: string
  brand: string
  category: string
  storage_range: string
  is_critical: boolean
  unit_price: number
  unit_of_measure: string
  min_safety_stock: number
}

export interface BatchSummary {
  id: number
  batch_number: string
  product_id: number
  product_name: string
  product_sku: string
  warehouse_code: string
  warehouse_name: string
  available_quantity: number
  initial_quantity: number
  manufacturing_date: string
  expiry_date: string
  status: string
  storage_condition: string
  days_to_expiry: number
}

export interface StockMovement {
  id: number
  movement_type: string
  quantity: number
  reference_doc: string
  timestamp: string
  notes?: string
}

export interface CustomerDispatch {
  id: number
  dispatch_number: string
  customer_code?: string
  customer_name: string
  customer_type: string
  quantity: number
  dispatch_date: string
  status: string
  tracking_ref?: string
}

export interface BatchDetail {
  batch: BatchSummary
  product: Product
  movements: StockMovement[]
  dispatches: CustomerDispatch[]
  total_dispatched: number
}

export interface TraceabilityRecipient {
  dispatch_number: string
  customer_code: string
  customer_name: string
  customer_type: string
  priority_tier: number
  contact_email?: string
  phone?: string
  quantity: number
  dispatch_date: string
  status: string
  tracking_ref?: string
}

export interface TraceabilityData {
  batch_number: string
  product_name: string
  product_sku: string
  remaining_warehouse_stock: number
  total_dispatched_quantity: number
  total_recipients_count: number
  breakdown: {
    hospitals: { count: number; quantity: number }
    chemists: { count: number; quantity: number }
  }
  recipients: TraceabilityRecipient[]
}

export interface ActionProposal {
  id: number
  run_id: string
  incident_id?: number
  action_type: string
  title: string
  description: string
  rationale: string
  supporting_evidence?: Record<string, unknown>
  target_entity: string
  expected_impact: string
  status: 'pending_review' | 'approved' | 'rejected'
  created_at: string
  approved_by?: string
  approved_at?: string
  rejection_reason?: string
}

export interface AgentEvent {
  id?: number
  step_number: number
  stage: string
  event_type: string
  tool_name?: string
  message: string
  data?: Record<string, unknown>
  timestamp: string
}

export interface VerificationCheck {
  check_name: string
  rule_description: string
  status: 'passed' | 'failed' | 'warning'
  computed_value: unknown
  expected_value: unknown
  is_valid: boolean
  details: string
}

export interface ResponseOption {
  option_id: string
  title: string
  allocation_plan: string
  shortage_mitigation: string
  lead_time_impact: string
  pros: string[]
  cons: string[]
  is_recommended: boolean
}

export interface FinalReport {
  incident_summary: string
  facts_retrieved: Record<string, unknown>
  affected_batches: string[]
  total_recipients: number
  quantities_reconciled: Record<string, unknown>
  alternatives_compared: ResponseOption[]
  recommendation: string
  assumptions_and_limits: string[]
  verification_results: VerificationCheck[]
  proposed_actions_count: number
  approval_required: boolean
}

export interface AgentRunDetail {
  run_id: string
  prompt: string
  state: 'queued' | 'intake' | 'planning' | 'executing' | 'analyzing' | 'verifying' | 'awaiting_approval' | 'completed' | 'failed'
  current_step: number
  created_at: string
  completed_at?: string
  events: AgentEvent[]
  plan?: Array<{ step: number; action: string; tool: string }>
  evidence?: Record<string, unknown>
  verification?: VerificationCheck[]
  final_report?: FinalReport
  proposals: ActionProposal[]
}

export interface TaskTemplate {
  id: string
  title: string
  category: string
  prompt: string
  description: string
}

export interface Customer {
  id: number
  code: string
  name: string
  customer_type: string
  location?: string
  credit_terms?: string
  priority_tier: number
  contact_email?: string
  phone?: string
  address?: string
}

export interface Warehouse {
  id: number
  code: string
  name: string
  location: string
  cold_storage_available: boolean
}

export interface TemperatureLog {
  id: number
  warehouse_id: number
  warehouse_name: string
  cold_room_unit: string
  recorded_at: string
  recorded_temperature_celsius: number
  permitted_range: string
  duration_minutes: number
  thermal_severity: string
  notes?: string
}

export interface PurchaseOrder {
  id: number
  po_number: string
  product_name: string
  product_sku: string
  supplier_name: string
  manufacturer?: string
  sku?: string
  quantity: number
  unit_price: number
  total_amount: number
  status: string
  order_date: string
  expected_delivery_date?: string
  is_overdue?: boolean
  days_overdue?: number
  urgency?: string
  notes?: string
}

export interface CreateBatchInput {
  batch_number: string
  product_id: number
  warehouse_id: number
  available_quantity: number
  initial_quantity?: number
  manufacturing_date?: string
  expiry_date: string
  status?: string
  storage_condition?: string
}

export interface UpdateBatchInput {
  available_quantity?: number
  status?: string
  warehouse_id?: number
  expiry_date?: string
  storage_condition?: string
}

export interface CreateProductInput {
  sku: string
  name: string
  molecule: string
  brand: string
  category: string
  storage_range?: string
  is_critical?: boolean
  unit_price?: number
  unit_of_measure?: string
  min_safety_stock?: number
}

export interface UpdateProductInput {
  name?: string
  molecule?: string
  brand?: string
  category?: string
  storage_range?: string
  is_critical?: boolean
  unit_price?: number
  unit_of_measure?: string
  min_safety_stock?: number
}

export interface CreateCustomerInput {
  code: string
  name: string
  customer_type: string
  location?: string
  credit_terms?: string
  priority_tier?: number
  contact_email?: string
  phone?: string
  address?: string
}

export interface UpdateCustomerInput {
  name?: string
  customer_type?: string
  location?: string
  credit_terms?: string
  priority_tier?: number
  contact_email?: string
  phone?: string
  address?: string
}

export interface CreateTemperatureLogInput {
  warehouse_id: number
  cold_room_unit: string
  recorded_temperature_celsius: number
  permitted_range?: string
  duration_minutes?: number
  thermal_severity?: string
  notes?: string
}

export interface CreatePurchaseOrderInput {
  product_id: number
  supplier_id?: number
  quantity: number
  unit_price?: number
  notes?: string
}

export interface CreateCustomProposalInput {
  action_type: string
  title: string
  description: string
  rationale: string
  target_entity: string
  expected_impact: string
}

export interface UpdateProposalInput {
  title?: string
  description?: string
  rationale?: string
  expected_impact?: string
}

// ---------------------------------------------------------------------------
// What-If Supply Chain Simulator Interfaces
// ---------------------------------------------------------------------------
export interface SimulatorPresetScenario {
  id: string
  name: string
  scenario_type: string
  batch_number?: string
  replacement_batch_number?: string
  warehouse_id?: number
  product_id?: number
  demand_surge_percent?: number
  supplier_delay_days?: number
  hospital_priority_weight?: number
  description: string
  severity: string
  benchmark: boolean
}

export interface SimulationScenarioRequest {
  scenario_type: string
  batch_number?: string
  product_id?: number
  warehouse_id?: number
  replacement_batch_number?: string
  demand_surge_percent?: number
  supplier_delay_days?: number
  hospital_priority_weight?: number
  custom_prompt?: string
}

export interface SimulationActionProposal {
  action_type: string
  title: string
  description: string
  target_entity: string
  rationale: string
  expected_impact: string
  evidence?: Record<string, any>
}

export interface SimulationStrategy {
  strategy_id: string
  name: string
  description: string
  hospital_fulfillment_percent: number
  retail_fulfillment_percent: number
  replacement_deficit: number
  emergency_order_units?: number
  emergency_po_units?: number
  estimated_cost: number
  lead_time_days: number
  projected_runway_days: number
  pros: string[]
  cons: string[]
  is_recommended: boolean
  action_proposals: SimulationActionProposal[]
}

export interface SimulationResult {
  simulation_id: string
  scenario_name: string
  scenario_type: string
  parameters_used: Record<string, any>
  baseline: Record<string, any>
  strategies: SimulationStrategy[]
  recommended_strategy_id: string
  executive_summary: string
  assumptions: string[]
  missing_data: string[]
  evidence: Record<string, any>
  clinical_safety_notice: string
}

export interface StageSimulationProposalRequest {
  simulation_id: string
  strategy_id: string
  strategy_name: string
  scenario_name: string
  proposals: SimulationActionProposal[]
}

export interface StageSimulationProposalResponse {
  success: boolean
  run_id: string
  created_proposal_ids: number[]
  message: string
  approval_center_url: string
}

// ---------------------------------------------------------------------------
// Local Ollama AI & Connection State Machine Types
// ---------------------------------------------------------------------------
export type LocalAIState =
  | 'checking_local_ai'
  | 'local_ai_connected'
  | 'model_missing'
  | 'ollama_not_installed_or_not_running'
  | 'local_connection_blocked_by_browser_security'
  | 'local_ai_request_failed'
  | 'dataset_fallback_active'

export interface LocalAIStatus {
  state: LocalAIState
  stateLabel: string
  isOnline: boolean
  modelAvailable: boolean
  model: string
  provider: string
  latencyMs?: number
  endpointUrl: string
  availableModels: string[]
  message: string
  browserSecurityBlocked?: boolean
  helperAvailable?: boolean
  lastChecked: string
}

export interface LocalAIConfig {
  ollamaUrl: string
  helperUrl: string
  modelName: string
  timeoutMs: number
}

