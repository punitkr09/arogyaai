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

const API_BASE = '/api'

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


