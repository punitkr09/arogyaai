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

export async function runAgentTask(prompt: string, mode: string = 'demo'): Promise<AgentRunDetail> {
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

export async function resetDemoData(): Promise<{ status: string; message: string }> {
  const res = await fetch(`${API_BASE}/demo/reset`, {
    method: 'POST',
  })
  return handleResponse<{ status: string; message: string }>(res)
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
