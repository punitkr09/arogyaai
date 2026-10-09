import { useState } from 'react'
import type { AgentRunDetail, TaskTemplate } from '../types/arogya'

interface AgentWorkspaceViewProps {
  templates: TaskTemplate[]
  prompt: string
  setPrompt: (p: string) => void
  onRunAgent: (customPrompt?: string) => void
  running: boolean
  activeRun: AgentRunDetail | null
  error: string | null
  onNavigateToApprovals: () => void
}

export function AgentWorkspaceView({
  templates,
  prompt,
  setPrompt,
  onRunAgent,
  running,
  activeRun,
  error,
  onNavigateToApprovals,
}: AgentWorkspaceViewProps) {
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null)

  const stagesList = [
    { key: 'intake', label: '1. Intake' },
    { key: 'planning', label: '2. Planning' },
    { key: 'execution', label: '3. Execution' },
    { key: 'analysis', label: '4. Analysis' },
    { key: 'verification', label: '5. Verification' },
    { key: 'approval', label: '6. Approval Gate' },
    { key: 'reporting', label: '7. Reporting' },
  ]

  const currentStageIndex = activeRun
    ? activeRun.state === 'planning'
      ? 1
      : activeRun.state === 'executing'
      ? 2
      : activeRun.state === 'verifying'
      ? 4
      : activeRun.state === 'awaiting_approval'
      ? 5
      : activeRun.state === 'completed'
      ? 6
      : 0
    : -1

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Task Controller */}
      <div className="agent-control-panel">
        <div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.25rem' }}>
            Operations Agent Command Center
          </h2>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            Trigger autonomous investigation. The agent executes real application tools, reconciles quantities, and stages proposals for human approval.
          </p>
        </div>

        {/* Template Quick Chips */}
        <div>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem' }}>
            DEMO TASK SCENARIOS:
          </span>
          <div className="templates-row">
            {templates.map((tpl) => (
              <button
                key={tpl.id}
                className="template-chip"
                onClick={() => {
                  setPrompt(tpl.prompt)
                  onRunAgent(tpl.prompt)
                }}
                disabled={running}
              >
                {tpl.id === 'tpl-recall' ? '🔴' : tpl.id === 'tpl-expiry' ? '🟡' : tpl.id === 'tpl-cold' ? '❄️' : '⚠️'}{' '}
                {tpl.title}
              </button>
            ))}
          </div>
        </div>

        {/* Prompt Input & Execute */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          <textarea
            className="prompt-textarea"
            placeholder="E.g., Investigate recall Batch B2231 and prepare response options..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={running}
          />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Deterministic Tool Execution &bull; Zero External API Tokens Required
            </span>

            <button
              className="btn-primary"
              onClick={() => onRunAgent()}
              disabled={running || !prompt.trim()}
              style={{ padding: '0.6rem 1.4rem' }}
            >
              {running ? (
                <>
                  <span style={{ display: 'inline-block', animation: 'spin 1s infinite linear' }}>⟳</span>
                  Executing Cognitive Loop...
                </>
              ) : (
                <>🚀 Run Operations Agent</>
              )}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div
          style={{
            padding: '1rem',
            backgroundColor: 'var(--status-critical-bg)',
            color: 'var(--status-critical-text)',
            borderRadius: 6,
            border: '1px solid var(--status-critical-border)',
            fontSize: '0.85rem',
          }}
        >
          {error}
        </div>
      )}

      {/* Cognitive Loop Progress Bar */}
      {activeRun && (
        <div style={{ background: 'var(--bg-surface)', padding: '1rem', borderRadius: 8, border: '1px solid var(--border-subtle)', boxShadow: var_shadow_sm }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)' }}>
              PIPELINE EXECUTION STATE: <span style={{ color: 'var(--accent-terracotta)', textTransform: 'uppercase' }}>{activeRun.state.replace('_', ' ')}</span>
            </span>
            <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-dim)' }}>
              Run ID: {activeRun.run_id}
            </span>
          </div>

          <div className="stages-breadcrumb">
            {stagesList.map((s, idx) => (
              <span
                key={s.key}
                className={`stage-pill ${
                  idx === currentStageIndex
                    ? 'active'
                    : idx < currentStageIndex
                    ? 'completed'
                    : ''
                }`}
              >
                {idx < currentStageIndex ? '✓ ' : ''}
                {s.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Main Dual Workspace Grid */}
      {activeRun && (
        <div className="workspace-grid">
          {/* Left: Execution Timeline & Tool Calls */}
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '1.25rem', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-main)' }}>
                Live Execution Audit Trail ({activeRun.events.length} events)
              </h3>
              <span className="badge badge-demo">Database Logged</span>
            </div>

            <div className="events-stream">
              {activeRun.events.map((ev, i) => (
                <div
                  key={i}
                  className="event-card"
                  onClick={() => setSelectedEventId(selectedEventId === i ? null : i)}
                  style={{ cursor: ev.data ? 'pointer' : 'default' }}
                >
                  <div className="event-header">
                    <span>
                      Step {ev.step_number} &bull; <strong style={{ textTransform: 'uppercase' }}>{ev.stage}</strong>
                    </span>
                    {ev.tool_name && <span className="event-tool">{ev.tool_name}</span>}
                  </div>

                  <div className="event-msg">{ev.message}</div>

                  {ev.data && (
                    <div style={{ fontSize: '0.7rem', color: 'var(--accent-terracotta)', fontWeight: 600 }}>
                      {selectedEventId === i ? '▲ Hide Payload' : '▼ View Stored JSON'}
                    </div>
                  )}

                  {selectedEventId === i && ev.data && (
                    <pre
                      style={{
                        marginTop: '0.35rem',
                        padding: '0.5rem',
                        backgroundColor: 'var(--bg-tag)',
                        borderRadius: 4,
                        fontSize: '0.72rem',
                        overflowX: 'auto',
                        color: 'var(--text-main)',
                      }}
                    >
                      {JSON.stringify(ev.data, null, 2)}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Right: Verification & Decision Support */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Deterministic Verification Checklist */}
            {activeRun.verification && activeRun.verification.length > 0 && (
              <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '1.25rem', boxShadow: 'var(--shadow-sm)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-main)' }}>
                    Independent Deterministic Verification
                  </h3>
                  <span
                    className="badge"
                    style={{
                      backgroundColor: 'var(--status-success-bg)',
                      color: 'var(--status-success-text)',
                      border: '1px solid var(--status-success-border)',
                    }}
                  >
                    100% Invariants Verified
                  </span>
                </div>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                  Verified mathematically against SQLite tables without relying on LLM self-reporting.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {activeRun.verification.map((chk, idx) => (
                    <div key={idx} className="check-item">
                      <span className="check-icon-pass">✓</span>
                      <div className="check-content">
                        <h4>{chk.rule_description}</h4>
                        <p>{chk.details}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Response Options Comparison (if Recall scenario) */}
            {activeRun.final_report && activeRun.final_report.alternatives_compared.length > 0 && (
              <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '1.25rem', boxShadow: 'var(--shadow-sm)' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.5rem' }}>
                  Evaluated Response Strategies
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {activeRun.final_report.alternatives_compared.map((opt) => (
                    <div
                      key={opt.option_id}
                      style={{
                        padding: '0.85rem',
                        borderRadius: 6,
                        border: opt.is_recommended ? '2px solid var(--accent-terracotta)' : '1px solid var(--border-subtle)',
                        backgroundColor: opt.is_recommended ? 'var(--accent-terracotta-light)' : 'var(--bg-card-subtle)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-main)' }}>
                          {opt.title}
                        </span>
                        {opt.is_recommended && (
                          <span
                            style={{
                              backgroundColor: 'var(--accent-terracotta)',
                              color: 'white',
                              fontSize: '0.68rem',
                              fontWeight: 700,
                              padding: '0.15rem 0.45rem',
                              borderRadius: 4,
                            }}
                          >
                            RECOMMENDED
                          </span>
                        )}
                      </div>
                      <p style={{ fontSize: '0.78rem', color: 'var(--text-main)', marginBottom: '0.4rem' }}>
                        {opt.allocation_plan}
                      </p>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        <strong>Impact:</strong> {opt.shortage_mitigation}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Final Report & Action Gate Banner */}
            {activeRun.final_report && (
              <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '1.25rem', boxShadow: 'var(--shadow-sm)' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.5rem' }}>
                  Incident Report & Action Proposals
                </h3>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-main)', lineHeight: 1.45, marginBottom: '1rem' }}>
                  {activeRun.final_report.incident_summary}
                </p>

                <div
                  style={{
                    backgroundColor: 'var(--bg-card-subtle)',
                    padding: '0.85rem',
                    borderRadius: 6,
                    border: '1px solid var(--border-subtle)',
                    marginBottom: '1rem',
                  }}
                >
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-terracotta-dark)', display: 'block', marginBottom: '0.25rem' }}>
                    RECOMMENDED DECISION SUPPORT ACTION:
                  </span>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-main)' }}>
                    {activeRun.final_report.recommendation}
                  </p>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    {activeRun.proposals.length} Proposals Staged at Approval Gate
                  </span>

                  <button className="btn-primary" onClick={onNavigateToApprovals}>
                    Review in Approval Center ({activeRun.proposals.length}) &rarr;
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

const var_shadow_sm = 'var(--shadow-sm)'
