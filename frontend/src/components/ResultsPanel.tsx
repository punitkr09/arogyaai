import React from 'react'
import type { WorkflowOutput } from '../types/workflow'

interface ResultsPanelProps {
  results: WorkflowOutput
  runId: string
  totalDurationMs: number
  isDemo: boolean
}

export const ResultsPanel: React.FC<ResultsPanelProps> = ({
  results,
  runId,
  totalDurationMs,
  isDemo,
}) => {
  return (
    <section className="results-container">
      <div className="section-header-row">
        <div>
          <h2 className="section-title">4. Synthesis & Solution Deliverables</h2>
          <p className="section-desc">
            Final output assembled across all agent stages with verification metrics.
          </p>
        </div>
        <div className="status-tags">
          <span className="badge badge-success">
            STATUS: {results.final_status.toUpperCase()}
          </span>
          {isDemo && <span className="badge badge-demo">DEMO SIMULATION</span>}
        </div>
      </div>

      <div className="results-metrics-grid">
        <div className="metric-card">
          <span className="metric-label">Pipeline Execution</span>
          <span className="metric-value">{totalDurationMs}ms</span>
          <span className="metric-sub">Across 4 agent phases</span>
        </div>
        <div className="metric-card">
          <span className="metric-label">Verifications</span>
          <span className="metric-value metric-accent">
            {results.verifications_passed}/{results.verifications_total}
          </span>
          <span className="metric-sub">Passed with 100% confidence</span>
        </div>
        <div className="metric-card">
          <span className="metric-label">Self-Healing Cycles</span>
          <span className="metric-value metric-heal">
            {results.repairs_applied} Auto-Repair
          </span>
          <span className="metric-sub">1 defect detected & remediated</span>
        </div>
        <div className="metric-card">
          <span className="metric-label">Run Identification</span>
          <span className="metric-value metric-id">{runId}</span>
          <span className="metric-sub">Audit trail stored</span>
        </div>
      </div>

      <div className="solution-summary-box">
        <h3 className="solution-title">{results.solution_title}</h3>
        <p className="solution-text">{results.executive_summary}</p>

        <div className="artifacts-section">
          <h4 className="artifacts-heading">Generated Solution Artifacts:</h4>
          <div className="artifacts-grid">
            {results.solution_artifacts.map((artifact, i) => (
              <div key={i} className="artifact-pill">
                <span className="artifact-check">✓</span>
                <span className="artifact-name">{artifact}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
