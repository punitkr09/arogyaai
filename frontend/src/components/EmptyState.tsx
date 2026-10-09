import React from 'react'
import type { SampleTemplate } from '../types/workflow'

interface EmptyStateProps {
  templates: SampleTemplate[]
  onSelectTemplate: (template: SampleTemplate) => void
}

export const EmptyState: React.FC<EmptyStateProps> = ({ templates, onSelectTemplate }) => {
  return (
    <div className="empty-state-card">
      <div className="empty-state-icon">🤖</div>
      <h3 className="empty-state-title">No Workflow Executed Yet</h3>
      <p className="empty-state-description">
        Input your system problem statement above or pick one of the hackathon starter templates to trigger the 4-stage autonomous agent pipeline:
      </p>

      <div className="agent-loop-preview">
        <div className="loop-step">
          <div className="loop-step-badge">1. PLANNER</div>
          <p className="loop-step-desc">Deconstructs goals, identifies constraints & specifies invariants</p>
        </div>
        <div className="loop-connector">→</div>
        <div className="loop-step">
          <div className="loop-step-badge">2. EXECUTOR</div>
          <p className="loop-step-desc">Synthesizes modular code & structural system blueprints</p>
        </div>
        <div className="loop-connector">→</div>
        <div className="loop-step">
          <div className="loop-step-badge">3. VERIFIER</div>
          <p className="loop-step-desc">Tests assertions & stress-tests boundary edge conditions</p>
        </div>
        <div className="loop-connector">→</div>
        <div className="loop-step">
          <div className="loop-step-badge">4. REPAIR</div>
          <p className="loop-step-desc">Remediates detected defects & re-validates self-healing</p>
        </div>
      </div>

      {templates.length > 0 && (
        <div className="empty-quickstart">
          <span className="quickstart-label">Quick Start with a scenario:</span>
          <div className="quickstart-buttons">
            {templates.map((tpl) => (
              <button
                key={tpl.id}
                type="button"
                className="btn-outline"
                onClick={() => onSelectTemplate(tpl)}
              >
                {tpl.title}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
