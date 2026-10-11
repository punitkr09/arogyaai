import React from 'react'
import type { SampleTemplate } from '../types/workflow'

interface ProblemInputProps {
  problemStatement: string
  onChange: (value: string) => void
  onRun: () => void
  onClear: () => void
  loading: boolean
  templates: SampleTemplate[]
  onSelectTemplate: (template: SampleTemplate) => void
  mode: 'demo' | 'live'
  onModeChange: (mode: 'demo' | 'live') => void
}

export const ProblemInput: React.FC<ProblemInputProps> = ({
  problemStatement,
  onChange,
  onRun,
  onClear,
  loading,
  templates,
  onSelectTemplate,
  mode,
  onModeChange,
}) => {
  const isInputValid = problemStatement.trim().length >= 3

  return (
    <section className="problem-input-card">
      <div className="card-header-row">
        <div>
          <h2 className="section-title">1. Define Problem Statement</h2>
          <p className="section-desc">
            Provide a system challenge or goal for the autonomous agent workflow to plan, execute, verify, and repair.
          </p>
        </div>
        <div className="mode-selector">
          <label className="mode-label">Mode:</label>
          <div className="mode-toggle-group">
            <button
              type="button"
              className={`mode-btn ${mode === 'demo' ? 'active' : ''}`}
              onClick={() => onModeChange('demo')}
              title="Runs structured heuristic simulation without requiring live LLM credits"
            >
              Heuristic Simulation
            </button>
            <button
              type="button"
              className={`mode-btn ${mode === 'live' ? 'active' : ''}`}
              onClick={() => onModeChange('live')}
              title="Runs live LLM if API keys are configured on the backend"
            >
              Live Agent
            </button>
          </div>
        </div>
      </div>

      {templates.length > 0 && (
        <div className="templates-container">
          <span className="templates-label">Sample Scenarios:</span>
          <div className="templates-chips">
            {templates.map((tpl) => (
              <button
                key={tpl.id}
                type="button"
                className="chip-btn"
                onClick={() => onSelectTemplate(tpl)}
                disabled={loading}
              >
                <span className="chip-category">{tpl.category}</span>
                <span className="chip-title">{tpl.title}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="textarea-wrapper">
        <textarea
          className="problem-textarea"
          rows={4}
          placeholder="Describe your technical challenge (e.g., 'Diagnose query latencies and CPU spikes in a multi-tenant PostgreSQL database...')"
          value={problemStatement}
          onChange={(e) => onChange(e.target.value)}
          disabled={loading}
        />
        <div className="textarea-footer">
          <span className="char-counter">
            {problemStatement.length} / 3000 chars {problemStatement.length > 0 && problemStatement.length < 3 && '(min 3 required)'}
          </span>
          <div className="actions-group">
            {problemStatement && (
              <button
                type="button"
                className="btn-secondary"
                onClick={onClear}
                disabled={loading}
              >
                Clear
              </button>
            )}
            <button
              type="button"
              className="btn-primary"
              onClick={onRun}
              disabled={loading || !isInputValid}
            >
              {loading ? (
                <>
                  <span className="spinner-sm" />
                  Running Workflow...
                </>
              ) : (
                <>
                  <span className="btn-icon">▶</span>
                  Run Agent Workflow
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
