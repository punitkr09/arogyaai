import React, { useState } from 'react'
import type { StageResult } from '../types/workflow'

interface StagesViewProps {
  stages: StageResult[]
  isDemo: boolean
}

export const StagesView: React.FC<StagesViewProps> = ({ stages, isDemo: _isDemo }) => {

  const [activeTab, setActiveTab] = useState<string>(stages[0]?.id || '')

  const getStageIcon = (name: string) => {
    switch (name) {
      case 'planner':
        return '🧭'
      case 'executor':
        return '⚡'
      case 'verifier':
        return '🔍'
      case 'repair':
        return '🛠️'
      default:
        return '🤖'
    }
  }

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'completed':
        return 'badge-success'
      case 'repaired':
        return 'badge-repair'
      case 'running':
        return 'badge-running'
      case 'failed':
        return 'badge-error'
      default:
        return 'badge-neutral'
    }
  }

  const selectedStage = stages.find((s) => s.id === activeTab) || stages[0]

  return (
    <section className="stages-container">
      <div className="section-header-row">
        <div>
          <h2 className="section-title">2. Agent Execution Pipeline</h2>
          <p className="section-desc">
            Visual breakdown of the multi-agent cognitive loop. Click any stage to inspect tactical reasoning and generated artifacts.
          </p>
        </div>
        <span className="badge badge-online">
          COGNITIVE REASONING PIPELINE
        </span>
      </div>

      {/* Stage Flow Pipeline */}
      <div className="pipeline-flow">
        {stages.map((stage, index) => {
          const isSelected = stage.id === (selectedStage?.id || '')
          return (
            <React.Fragment key={stage.id}>
              <button
                type="button"
                className={`pipeline-node ${isSelected ? 'selected' : ''}`}
                onClick={() => setActiveTab(stage.id)}
              >
                <div className="node-header">
                  <span className="node-icon">{getStageIcon(stage.name)}</span>
                  <span className={`badge ${getStatusBadgeClass(stage.status)}`}>
                    {stage.status.toUpperCase()}
                  </span>
                </div>
                <div className="node-title">{stage.title}</div>
                <div className="node-meta">
                  <span>{stage.duration_ms}ms</span>
                  {stage.is_demo && <span className="demo-tag">DEMO</span>}
                </div>
              </button>
              {index < stages.length - 1 && (
                <div className="pipeline-connector">
                  <span className="connector-arrow">→</span>
                </div>
              )}
            </React.Fragment>
          )
        })}
      </div>

      {/* Selected Stage Detail Panel */}
      {selectedStage && (
        <div className="stage-detail-card">
          <div className="stage-detail-header">
            <div className="stage-detail-title-group">
              <span className="stage-detail-icon">{getStageIcon(selectedStage.name)}</span>
              <div>
                <h3 className="stage-detail-title">{selectedStage.title}</h3>
                <p className="stage-detail-summary">{selectedStage.summary}</p>
              </div>
            </div>
            <div className="stage-detail-tags">
              <span className={`badge ${getStatusBadgeClass(selectedStage.status)}`}>
                {selectedStage.status.toUpperCase()}
              </span>
              <span className="badge badge-time">
                Execution: {selectedStage.duration_ms}ms
              </span>
              {selectedStage.is_demo && (
                <span className="badge badge-demo">DEMO</span>
              )}
            </div>
          </div>

          <div className="stage-columns">
            {/* Steps & Reasoning */}
            <div className="stage-column">
              <h4 className="column-heading">Agent Operations & Reasoning</h4>
              <ul className="details-list">
                {selectedStage.details.map((detail, idx) => (
                  <li key={idx} className="details-item">
                    <span className="bullet">▹</span>
                    <span>{detail}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Generated Artifacts / Inspect Payload */}
            <div className="stage-column">
              <h4 className="column-heading">Stage Artifacts & State</h4>
              <div className="code-viewer">
                <pre>
                  <code>{JSON.stringify(selectedStage.artifacts, null, 2)}</code>
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
