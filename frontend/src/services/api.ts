import type {
  HealthResponse,
  SampleTemplate,
  WorkflowRunRequest,
  WorkflowRunResponse,
} from '../types/workflow'
import type {
  DashboardSummary,
  BatchSummary,
  BatchDetail,
  Product,
  AgentRunDetail,
  TaskTemplate,
  ActionProposal,
} from '../types/arogya'

const rawApiUrl = (import.meta.env.VITE_API_URL as string | undefined)?.trim() || ''
const API_BASE = rawApiUrl ? `${rawApiUrl.replace(/\/+$/, '')}/api` : '/api'

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let errorDetail = `HTTP ${res.status}: ${res.statusText}`
    try {
      const errorJson = await res.json()
      if (errorJson.detail) {
        errorDetail = typeof errorJson.detail === 'string' ? errorJson.detail : JSON.stringify(errorJson.detail)
      }
    } catch {
      // ignore
    }
    throw new Error(errorDetail)
  }
  return res.json() as Promise<T>
}

// ---------------------------------------------------------------------------
// Arogya AI Core Endpoints
// ---------------------------------------------------------------------------

export async function fetchHealth(): Promise<HealthResponse> {
  const res = await fetch(`${API_BASE}/health`)
  return handleResponse<HealthResponse>(res)
}

export async function fetchDashboardSummary(): Promise<DashboardSummary> {
  const res = await fetch(`${API_BASE}/dashboard/summary`)
  return handleResponse<DashboardSummary>(res)
}

export async function fetchBatches(
  search?: string,
  status?: string,
  warehouseCode?: string
): Promise<BatchSummary[]> {
  const params = new URLSearchParams()
  if (search) params.set('search', search)
  if (status) params.set('status', status)
  if (warehouseCode) params.set('warehouse_code', warehouseCode)

  const url = `${API_BASE}/inventory/batches${params.toString() ? `?${params.toString()}` : ''}`
  const res = await fetch(url)
  return handleResponse<BatchSummary[]>(res)
}

export async function fetchBatchDetails(batchNumber: string): Promise<BatchDetail> {
  const res = await fetch(`${API_BASE}/inventory/batches/${encodeURIComponent(batchNumber)}`)
  return handleResponse<BatchDetail>(res)
}

export async function fetchProducts(): Promise<Product[]> {
  const res = await fetch(`${API_BASE}/inventory/products`)
  return handleResponse<Product[]>(res)
}

export async function fetchAgentTemplates(): Promise<TaskTemplate[]> {
  const res = await fetch(`${API_BASE}/agent/templates`)
  return handleResponse<TaskTemplate[]>(res)
}

export async function runAgentTask(prompt: string, mode: string = 'operations'): Promise<AgentRunDetail> {
  const res = await fetch(`${API_BASE}/agent/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, mode }),
  })
  return handleResponse<AgentRunDetail>(res)
}

export async function fetchRunDetails(runId: string): Promise<AgentRunDetail> {
  const res = await fetch(`${API_BASE}/agent/runs/${encodeURIComponent(runId)}`)
  return handleResponse<AgentRunDetail>(res)
}

export async function fetchAgentRuns(limit: number = 30): Promise<AgentRunDetail[]> {
  const res = await fetch(`${API_BASE}/agent/runs?limit=${limit}`)
  return handleResponse<AgentRunDetail[]>(res)
}

export async function fetchBatchTrace(batchNumber: string): Promise<import('../types/arogya').TraceabilityData> {
  const res = await fetch(`${API_BASE}/inventory/batches/${encodeURIComponent(batchNumber)}/trace`)
  return handleResponse<import('../types/arogya').TraceabilityData>(res)
}

export async function createDispatch(data: {
  batch_number: string
  customer_id: number
  quantity: number
  order_reference?: string
}): Promise<{
  status: string
  dispatch_number: string
  batch_number: string
  quantity: number
  remaining_stock: number
}> {
  const res = await fetch(`${API_BASE}/inventory/dispatch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  return handleResponse(res)
}

export async function fetchProposals(status?: string): Promise<ActionProposal[]> {
  const url = status ? `${API_BASE}/approvals?status=${encodeURIComponent(status)}` : `${API_BASE}/approvals`
  const res = await fetch(url)
  return handleResponse<ActionProposal[]>(res)
}

export async function actOnProposal(
  proposalId: number,
  decision: 'approved' | 'rejected',
  approverRole: string,
  approverName: string,
  notes?: string
): Promise<ActionProposal> {
  const res = await fetch(`${API_BASE}/approvals/${proposalId}/action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      decision,
      approver_role: approverRole,
      approver_name: approverName,
      notes,
    }),
  })
  return handleResponse<ActionProposal>(res)
}

export async function seedAdminData(): Promise<{ status: string; message: string; sample_data: boolean }> {
  const res = await fetch(`${API_BASE}/admin/seed`, {
    method: 'POST',
  })
  return handleResponse<{ status: string; message: string; sample_data: boolean }>(res)
}

export async function resetDemoData(): Promise<{ status: string; message: string }> {
  return seedAdminData()
}

// ---------------------------------------------------------------------------
// Backward-compatibility endpoints
// ---------------------------------------------------------------------------

export async function fetchTemplates(): Promise<SampleTemplate[]> {
  const res = await fetch(`${API_BASE}/workflow/templates`)
  return handleResponse<SampleTemplate[]>(res)
}

export async function executeWorkflow(req: WorkflowRunRequest): Promise<WorkflowRunResponse> {
  const res = await fetch(`${API_BASE}/workflow/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  })
  return handleResponse<WorkflowRunResponse>(res)
}

// ---------------------------------------------------------------------------
// CRUD Entity Management APIs
// ---------------------------------------------------------------------------

export async function createBatch(data: import('../types/arogya').CreateBatchInput): Promise<BatchSummary> {
  const res = await fetch(`${API_BASE}/inventory/batches`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  return handleResponse<BatchSummary>(res)
}

export async function updateBatch(batchNumber: string, data: import('../types/arogya').UpdateBatchInput): Promise<BatchSummary> {
  const res = await fetch(`${API_BASE}/inventory/batches/${encodeURIComponent(batchNumber)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  return handleResponse<BatchSummary>(res)
}

export async function createProduct(data: import('../types/arogya').CreateProductInput): Promise<Product> {
  const res = await fetch(`${API_BASE}/inventory/products`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  return handleResponse<Product>(res)
}

export async function updateProduct(productId: number, data: import('../types/arogya').UpdateProductInput): Promise<Product> {
  const res = await fetch(`${API_BASE}/inventory/products/${productId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  return handleResponse<Product>(res)
}

export async function fetchCustomers(): Promise<import('../types/arogya').Customer[]> {
  const res = await fetch(`${API_BASE}/inventory/customers`)
  return handleResponse<import('../types/arogya').Customer[]>(res)
}

export async function createCustomer(data: import('../types/arogya').CreateCustomerInput): Promise<import('../types/arogya').Customer> {
  const res = await fetch(`${API_BASE}/inventory/customers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  return handleResponse<import('../types/arogya').Customer>(res)
}

export async function updateCustomer(customerId: number, data: import('../types/arogya').UpdateCustomerInput): Promise<import('../types/arogya').Customer> {
  const res = await fetch(`${API_BASE}/inventory/customers/${customerId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  return handleResponse<import('../types/arogya').Customer>(res)
}

export async function fetchWarehouses(): Promise<import('../types/arogya').Warehouse[]> {
  const res = await fetch(`${API_BASE}/inventory/warehouses`)
  return handleResponse<import('../types/arogya').Warehouse[]>(res)
}

export async function fetchTemperatureLogs(): Promise<import('../types/arogya').TemperatureLog[]> {
  const res = await fetch(`${API_BASE}/inventory/temperature-logs`)
  return handleResponse<import('../types/arogya').TemperatureLog[]>(res)
}

export async function createTemperatureLog(data: import('../types/arogya').CreateTemperatureLogInput): Promise<import('../types/arogya').TemperatureLog> {
  const res = await fetch(`${API_BASE}/inventory/temperature-logs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  return handleResponse<import('../types/arogya').TemperatureLog>(res)
}

export async function fetchPurchaseOrders(): Promise<import('../types/arogya').PurchaseOrder[]> {
  const res = await fetch(`${API_BASE}/inventory/purchase-orders`)
  return handleResponse<import('../types/arogya').PurchaseOrder[]>(res)
}

export async function createPurchaseOrder(data: import('../types/arogya').CreatePurchaseOrderInput): Promise<import('../types/arogya').PurchaseOrder> {
  const res = await fetch(`${API_BASE}/inventory/purchase-orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  return handleResponse<import('../types/arogya').PurchaseOrder>(res)
}

export async function updatePurchaseOrderStatus(poId: number, status: string, notes?: string): Promise<import('../types/arogya').PurchaseOrder> {
  const res = await fetch(`${API_BASE}/inventory/purchase-orders/${poId}/status`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status, notes }),
  })
  return handleResponse<import('../types/arogya').PurchaseOrder>(res)
}

export async function createCustomProposal(data: import('../types/arogya').CreateCustomProposalInput): Promise<ActionProposal> {
  const res = await fetch(`${API_BASE}/approvals/custom`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  return handleResponse<ActionProposal>(res)
}

export async function updateProposal(proposalId: number, data: import('../types/arogya').UpdateProposalInput): Promise<ActionProposal> {
  const res = await fetch(`${API_BASE}/approvals/${proposalId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  return handleResponse<ActionProposal>(res)
}

// ---------------------------------------------------------------------------
// What-If Supply Chain Simulator API
// ---------------------------------------------------------------------------
export async function fetchSimulatorScenarios(): Promise<import('../types/arogya').SimulatorPresetScenario[]> {
  const res = await fetch(`${API_BASE}/simulator/scenarios`)
  return handleResponse<import('../types/arogya').SimulatorPresetScenario[]>(res)
}

export async function runSimulatorScenario(payload: import('../types/arogya').SimulationScenarioRequest): Promise<import('../types/arogya').SimulationResult> {
  const res = await fetch(`${API_BASE}/simulator/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return handleResponse<import('../types/arogya').SimulationResult>(res)
}

export async function parseSimulatorPrompt(prompt: string): Promise<{ prompt: string; extracted_parameters: Record<string, any> }> {
  const res = await fetch(`${API_BASE}/simulator/parse-prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  })
  return handleResponse<{ prompt: string; extracted_parameters: Record<string, any> }>(res)
}

export async function explainSimulatorScenario(prompt: string): Promise<{ prompt: string; explanation: string }> {
  const res = await fetch(`${API_BASE}/simulator/explain`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  })
  return handleResponse<{ prompt: string; explanation: string }>(res)
}

export async function stageSimulatorProposal(payload: import('../types/arogya').StageSimulationProposalRequest): Promise<import('../types/arogya').StageSimulationProposalResponse> {
  const res = await fetch(`${API_BASE}/simulator/propose`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return handleResponse<import('../types/arogya').StageSimulationProposalResponse>(res)
}

// ---------------------------------------------------------------------------
// Pharma Dataset Core APIs
// ---------------------------------------------------------------------------

export async function fetchProductsCatalogue(params?: {
  search?: string
  category?: string
  storage?: string
  is_critical?: boolean
  page?: number
  page_size?: number
}): Promise<{ items: import('../types/arogya').Product[]; total: number; page: number; page_size: number }> {
  const query = new URLSearchParams()
  if (params?.search) query.set('search', params.search)
  if (params?.category) query.set('category', params.category)
  if (params?.storage) query.set('storage', params.storage)
  if (params?.is_critical !== undefined) query.set('is_critical', String(params.is_critical))
  if (params?.page) query.set('page', String(params.page))
  if (params?.page_size) query.set('page_size', String(params.page_size))

  const res = await fetch(`${API_BASE}/products?${query.toString()}`)
  return handleResponse(res)
}

export async function fetchProductDetail(sku: string): Promise<{
  product: import('../types/arogya').Product
  batches: import('../types/arogya').BatchSummary[]
  suppliers: import('../types/arogya').Supplier[]
  purchase_orders: import('../types/arogya').PurchaseOrder[]
  recent_dispatches: import('../types/arogya').Dispatch[]
  metrics: Record<string, any>
}> {
  const res = await fetch(`${API_BASE}/products/${encodeURIComponent(sku)}`)
  return handleResponse(res)
}

export async function fetchCustomersList(params?: {
  search?: string
  customer_type?: string
  location?: string
  page?: number
  page_size?: number
}): Promise<{ items: import('../types/arogya').Customer[]; total: number; page: number; page_size: number }> {
  const query = new URLSearchParams()
  if (params?.search) query.set('search', params.search)
  if (params?.customer_type) query.set('customer_type', params.customer_type)
  if (params?.location) query.set('location', params.location)
  if (params?.page) query.set('page', String(params.page))
  if (params?.page_size) query.set('page_size', String(params.page_size))

  const res = await fetch(`${API_BASE}/customers?${query.toString()}`)
  return handleResponse(res)
}

export async function fetchCustomerDetail(code: string): Promise<{
  customer: import('../types/arogya').Customer
  dispatches: import('../types/arogya').Dispatch[]
  metrics: Record<string, any>
}> {
  const res = await fetch(`${API_BASE}/customers/${encodeURIComponent(code)}`)
  return handleResponse(res)
}

export async function fetchSuppliersList(params?: {
  search?: string
  page?: number
  page_size?: number
}): Promise<{ items: import('../types/arogya').Supplier[]; total: number; page: number; page_size: number }> {
  const query = new URLSearchParams()
  if (params?.search) query.set('search', params.search)
  if (params?.page) query.set('page', String(params.page))
  if (params?.page_size) query.set('page_size', String(params.page_size))

  const res = await fetch(`${API_BASE}/suppliers?${query.toString()}`)
  return handleResponse(res)
}

export async function fetchSupplierDetail(id: number): Promise<{
  supplier: import('../types/arogya').Supplier
  product?: import('../types/arogya').Product
  purchase_orders: import('../types/arogya').PurchaseOrder[]
  active_inventory: import('../types/arogya').BatchSummary[]
  reorder_recommendation?: Record<string, any>
}> {
  const res = await fetch(`${API_BASE}/suppliers/${id}`)
  return handleResponse(res)
}

export async function createSupplier(data: {
  name: string
  sku?: string
  lead_time_days?: number
  min_order_quantity?: number
  return_window_days?: number
  contact_email?: string
  phone?: string
}): Promise<import('../types/arogya').Supplier> {
  const res = await fetch(`${API_BASE}/suppliers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  return handleResponse(res)
}

export async function fetchPurchaseOrdersList(params?: {
  status?: string
  sku?: string
  manufacturer?: string
  is_overdue?: boolean
  page?: number
  page_size?: number
}): Promise<{ items: import('../types/arogya').PurchaseOrder[]; total: number; page: number; page_size: number }> {
  const query = new URLSearchParams()
  if (params?.status) query.set('status', params.status)
  if (params?.sku) query.set('sku', params.sku)
  if (params?.manufacturer) query.set('manufacturer', params.manufacturer)
  if (params?.is_overdue !== undefined) query.set('is_overdue', String(params.is_overdue))
  if (params?.page) query.set('page', String(params.page))
  if (params?.page_size) query.set('page_size', String(params.page_size))

  const res = await fetch(`${API_BASE}/purchase-orders?${query.toString()}`)
  return handleResponse(res)
}

export async function fetchPurchaseOrderRecommendations(): Promise<{
  recommendations: Array<{
    sku: string
    product_name: string
    current_stock: number
    min_safety_stock: number
    burn_rate: number
    lead_time_days: number
    supplier_moq: number
    recommended_order_quantity: number
    reason: string
  }>
}> {
  const res = await fetch(`${API_BASE}/purchase-orders/recommendations`)
  return handleResponse(res)
}

export async function fetchDispatchesList(params?: {
  search?: string
  customer_id?: number
  batch_number?: string
  sku?: string
  page?: number
  page_size?: number
}): Promise<{ items: import('../types/arogya').Dispatch[]; total: number; page: number; page_size: number }> {
  const query = new URLSearchParams()
  if (params?.search) query.set('search', params.search)
  if (params?.customer_id) query.set('customer_id', String(params.customer_id))
  if (params?.batch_number) query.set('batch_number', params.batch_number)
  if (params?.sku) query.set('sku', params.sku)
  if (params?.page) query.set('page', String(params.page))
  if (params?.page_size) query.set('page_size', String(params.page_size))

  const res = await fetch(`${API_BASE}/dispatches?${query.toString()}`)
  return handleResponse(res)
}

export async function fetchRecallsList(status?: string): Promise<{ items: import('../types/arogya').Recall[]; total: number }> {
  const url = status ? `${API_BASE}/recalls?status=${encodeURIComponent(status)}` : `${API_BASE}/recalls`
  const res = await fetch(url)
  return handleResponse(res)
}

export async function fetchRecallDetail(idOrSku: string): Promise<{
  recall: import('../types/arogya').Recall
  affected_batches: import('../types/arogya').BatchSummary[]
  affected_dispatches: import('../types/arogya').Dispatch[]
  affected_recipients: Array<{ customer_name: string; customer_type: string; quantity: number }>
  total_dispatched_units: number
  total_remaining_warehouse_units: number
}> {
  const res = await fetch(`${API_BASE}/recalls/${encodeURIComponent(idOrSku)}`)
  return handleResponse(res)
}

export async function fetchAnalyticsData(): Promise<import('../types/arogya').AnalyticsOverview> {
  const res = await fetch(`${API_BASE}/analytics/overview`)
  return handleResponse(res)
}

export async function createOutboundDispatch(data: {
  batch_number: string
  customer_code: string
  quantity: number
  notes?: string
}): Promise<import('../types/arogya').Dispatch> {
  const res = await fetch(`${API_BASE}/dispatches`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  return handleResponse(res)
}

export async function fetchAlertsList(): Promise<{
  alerts: Array<{
    id: string
    priority: string
    category: string
    title: string
    description: string
    timestamp: string
    action_prompt: string
  }>
  total: number
}> {
  const res = await fetch(`${API_BASE}/alerts`)
  return handleResponse(res)
}

export async function chatAgent(query: string, sessionId?: string): Promise<{
  answer: string
  evidence: Record<string, any>
  facts_retrieved: Record<string, any>
  recommendations?: string[]
  proposals?: any[]
  session_id: string
}> {
  const res = await fetch(`${API_BASE}/agent/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, session_id: sessionId }),
  })
  return handleResponse(res)
}

export async function fetchTelemetryAnalysis(params?: {
  warehouse?: string
  cold_room?: string
  excursions_only?: boolean
  page?: number
  limit?: number
}): Promise<{
  items: import('../types/arogya').TemperatureLog[]
  total: number
  page: number
  limit: number
  total_pages: number
  telemetry_statistics: {
    total_readings_logged: number
    overall_min_temperature_c: number
    overall_max_temperature_c: number
    overall_avg_temperature_c: number
    total_excursions_detected: number
    permitted_range: string
    facilities: Record<
      string,
      {
        total_readings: number
        min_c: number
        max_c: number
        avg_c: number
        excursions_count: number
      }
    >
    active_excursions: Array<{
      warehouse: string
      cold_room: string
      temperature_c: number
      timestamp: string
      duration_minutes: number
    }>
  }
}> {
  const query = new URLSearchParams()
  if (params?.warehouse) query.set('warehouse', params.warehouse)
  if (params?.cold_room) query.set('cold_room', params.cold_room)
  if (params?.excursions_only) query.set('excursions_only', 'true')
  if (params?.page) query.set('page', String(params.page))
  if (params?.limit) query.set('limit', String(params.limit))

  const res = await fetch(`${API_BASE}/temperature-logs?${query.toString()}`)
  return handleResponse(res)
}

export async function fetchAffectedColdChainInventory(): Promise<{
  excursions: Array<{
    excursion: {
      id: number
      warehouse: string
      cold_room: string
      recorded_temperature: number
      recorded_at: string
      duration_minutes: number
    }
    potentially_exposed_batches: Array<{
      batch_number: string
      product_sku: string
      product_name: string
      is_critical: boolean
      available_quantity: number
      expiry_date: string
      status: string
    }>
    total_exposed_units: number
  }>
  total_excursions: number
}> {
  const res = await fetch(`${API_BASE}/temperature-logs/excursions/affected-inventory`)
  return handleResponse(res)
}

export async function agentCreateData(recordType: string, data: Record<string, any>): Promise<any> {
  const res = await fetch(`${API_BASE}/agent/create-data`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ record_type: recordType, data }),
  })
  return handleResponse(res)
}

export interface AIStatusResponse {
  status_label: 'Connected — model available' | 'Offline — Ollama unavailable' | 'Model missing or unavailable' | string
  is_online: boolean
  model_available: boolean
  provider: string
  model: string
  latency_ms: number
  available_models: string[]
  message: string
  configured_base_url: string
  timestamp: string
}

export async function fetchAIStatus(): Promise<AIStatusResponse> {
  const res = await fetch(`${API_BASE}/ai/status`)
  return handleResponse<AIStatusResponse>(res)
}

export async function deleteProduct(productId: number): Promise<{ status: string; message: string }> {
  const res = await fetch(`${API_BASE}/products/${productId}`, {
    method: 'DELETE',
  })
  return handleResponse(res)
}

export async function updateRecallStatus(
  recallId: number,
  status: string,
  notes?: string
): Promise<{ id: number; sku: string; status: string; message: string }> {
  const query = new URLSearchParams({ status })
  if (notes) query.set('notes', notes)
  const res = await fetch(`${API_BASE}/recalls/${recallId}/status?${query.toString()}`, {
    method: 'PUT',
  })
  return handleResponse(res)
}

export async function createRecall(data: {
  sku: string
  batches: string
  reason: string
  recall_class: string
}): Promise<import('../types/arogya').Recall & { message?: string; quarantined_batches_count?: number }> {
  const res = await fetch(`${API_BASE}/recalls`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  return handleResponse(res)
}


