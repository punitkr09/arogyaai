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
  state: 'queued' | 'planning' | 'executing' | 'verifying' | 'awaiting_approval' | 'completed' | 'failed'
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
