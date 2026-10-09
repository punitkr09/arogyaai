export interface HealthResponse {
  status: string
  app_name: string
  version: string
  environment: string
  timestamp: string
  mode: string
  available_stages: string[]
}

export type StageName = 'planner' | 'executor' | 'verifier' | 'repair'
export type StageStatus = 'idle' | 'running' | 'completed' | 'failed' | 'repaired'

export interface StageResult {
  id: string
  name: StageName
  title: string
  status: StageStatus
  duration_ms: number
  summary: string
  details: string[]
  artifacts: Record<string, unknown>
  is_demo: boolean
}

export interface TimelineEvent {
  id: string
  timestamp: string
  stage: string
  level: 'info' | 'success' | 'warning' | 'error'
  message: string
  details?: string | null
}

export interface WorkflowOutput {
  final_status: string
  solution_title: string
  executive_summary: string
  solution_artifacts: string[]
  verifications_passed: number
  verifications_total: number
  repairs_applied: number
}

export interface WorkflowRunRequest {
  problem_statement: string
  mode?: 'demo' | 'live'
  max_repair_iterations?: number
}

export interface WorkflowRunResponse {
  run_id: string
  problem_statement: string
  mode: 'demo' | 'live'
  is_demo: boolean
  demo_badge: string
  disclaimer: string
  total_duration_ms: number
  stages: StageResult[]
  timeline: TimelineEvent[]
  results: WorkflowOutput
  limitations: string[]
}

export interface SampleTemplate {
  id: string
  title: string
  category: string
  problem_statement: string
}
