import { useEffect, useState } from 'react'
import type { AgentRunDetail } from '../types/arogya'
import { fetchAgentRuns, fetchRunDetails } from '../services/api'

interface AuditLogViewProps {
  onInspectRunInWorkspace?: (run: AgentRunDetail) => void
}

export function AuditLogView({ onInspectRunInWorkspace }: AuditLogViewProps) {
  const [runs, setRuns] = useState<AgentRunDetail[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [selectedRun, setSelectedRun] = useState<AgentRunDetail | null>(null)
  const [modalLoading, setModalLoading] = useState<boolean>(false)

  const loadRuns = async () => {
    setLoading(true)
    try {
      const data = await fetchAgentRuns(50)
      setRuns(data)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRuns()
  }, [])

  const handleOpenRunModal = async (runId: string) => {
    setModalLoading(true)
    const existing = runs.find((r) => r.run_id === runId)
    if (existing) {
      setSelectedRun(existing)
    }
    try {
      const detail = await fetchRunDetails(runId)
      setSelectedRun(detail)
    } catch {
      if (!existing) {
        alert(`Run ${runId} dossier could not be retrieved from database.`)
      }
    } finally {
      setModalLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Banner */}
      <div className="agent-control-panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.25rem' }}>
              Regulatory Audit Trail & Operational Run Logs
            </h2>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Immutable chronological record of every autonomous investigation, deterministic tool invocation, invariant check, and Qualified Person decision.
            </p>
          </div>

          <button className="btn-secondary" onClick={loadRuns} disabled={loading}>
            {loading ? 'Refreshing...' : '↻ Refresh Run Logs'}
          </button>
        </div>
      </div>

      {/* Runs Table */}
      <div className="table-container">
        <div className="table-toolbar">
          <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-main)' }}>
            Recorded Investigations ({runs.length} runs)
          </h3>
          <span className="badge badge-online">Audit Ready</span>
        </div>

        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            Loading audit runs from database...
          </div>
        ) : runs.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            No agent runs logged in the database yet. Launch an investigation from the Agent Workspace!
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Run Identifier</th>
                <th>Timestamp</th>
                <th>Operational Request / Prompt</th>
                <th>Status</th>
                <th>Cognitive Steps</th>
                <th>Proposals Staged</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.run_id}>
                  <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{r.run_id}</td>
                  <td>{new Date(r.created_at).toLocaleString()}</td>
                  <td style={{ maxWidth: 360 }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{r.prompt}</div>
                  </td>
                  <td>
                    <span
                      style={{
                        padding: '0.15rem 0.45rem',
                        borderRadius: 4,
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        backgroundColor:
                          r.state === 'completed'
                            ? 'var(--status-success-bg)'
                            : r.state === 'awaiting_approval'
                            ? 'var(--status-warning-bg)'
                            : 'var(--bg-tag)',
                        color:
                          r.state === 'completed'
                            ? 'var(--status-success-text)'
                            : r.state === 'awaiting_approval'
                            ? 'var(--status-warning-text)'
                            : 'inherit',
                        border: '1px solid currentColor',
                      }}
                    >
                      {r.state.toUpperCase().replace('_', ' ')}
                    </span>
                  </td>
                  <td>
                    <span style={{ fontWeight: 600 }}>{r.current_step}</span> stages &bull;{' '}
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{r.events.length} events</span>
                  </td>
                  <td>
                    <span
                      style={{
                        fontWeight: 700,
                        color: r.proposals.length > 0 ? 'var(--accent-terracotta)' : 'var(--text-muted)',
                      }}
                    >
                      {r.proposals.length} proposals
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        className="btn-secondary"
                        style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}
                        onClick={() => handleOpenRunModal(r.run_id)}
                      >
                        Inspect Dossier &rarr;
                      </button>
                      {onInspectRunInWorkspace && (
                        <button
                          className="btn-primary"
                          style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}
                          onClick={() => onInspectRunInWorkspace(r)}
                        >
                          Workspace
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Run Dossier Modal */}
      {selectedRun && (
        <div className="modal-overlay" onClick={() => setSelectedRun(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 750 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ fontSize: '1.15rem', color: 'var(--text-main)', marginBottom: '0.25rem' }}>
                  Audit Dossier: <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-terracotta)' }}>{selectedRun.run_id}</span>
                </h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Request: &ldquo;{selectedRun.prompt}&rdquo; &bull; {new Date(selectedRun.created_at).toLocaleString()}
                </p>
              </div>
              <button
                onClick={() => setSelectedRun(null)}
                style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                &times;
              </button>
            </div>

            {modalLoading ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                Loading full dossier...
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '70vh', overflowY: 'auto' }}>
                {/* Status Strip */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', background: 'var(--bg-card-subtle)', padding: '0.85rem', borderRadius: 6 }}>
                  <div>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block' }}>EXECUTION STATUS</span>
                    <span style={{ fontSize: '1.1rem', fontWeight: 700, textTransform: 'uppercase' }}>
                      {selectedRun.state.replace('_', ' ')}
                    </span>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block' }}>AUDITED EVENTS</span>
                    <span style={{ fontSize: '1.1rem', fontWeight: 700 }}>{selectedRun.events.length} entries</span>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block' }}>ACTION PROPOSALS</span>
                    <span style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--accent-terracotta)' }}>
                      {selectedRun.proposals.length} staged
                    </span>
                  </div>
                </div>

                {/* Final Report if available */}
                {selectedRun.final_report && (
                  <div style={{ background: 'var(--bg-surface)', padding: '0.85rem', borderRadius: 6, border: '1px solid var(--border-subtle)' }}>
                    <h4 style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.35rem' }}>
                      Executive Summary & Recommendation
                    </h4>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-main)', lineHeight: 1.45, marginBottom: '0.5rem' }}>
                      {selectedRun.final_report.incident_summary}
                    </p>
                    <div style={{ padding: '0.5rem 0.75rem', backgroundColor: 'var(--bg-tag)', borderRadius: 4, fontSize: '0.78rem' }}>
                      <strong>Recommended Action:</strong> {selectedRun.final_report.recommendation}
                    </div>
                  </div>
                )}

                {/* Events list */}
                <div>
                  <h4 style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.5rem' }}>
                    Tool Execution & Reasoning Events
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {selectedRun.events.map((ev, i) => (
                      <div
                        key={i}
                        style={{
                          padding: '0.65rem 0.85rem',
                          background: 'var(--bg-surface)',
                          borderRadius: 6,
                          border: '1px solid var(--border-subtle)',
                          fontSize: '0.78rem',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                          <span style={{ fontWeight: 600, textTransform: 'uppercase', color: 'var(--accent-terracotta)' }}>
                            Stage {ev.step_number}: {ev.stage}
                          </span>
                          {ev.tool_name && (
                            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                              tool: {ev.tool_name}
                            </span>
                          )}
                        </div>
                        <div style={{ color: 'var(--text-main)' }}>{ev.message}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <button className="btn-secondary" onClick={() => setSelectedRun(null)}>
                    Close Dossier
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
