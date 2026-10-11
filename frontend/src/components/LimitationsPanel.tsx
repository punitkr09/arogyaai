import React from 'react'

interface LimitationsPanelProps {
  limitations: string[]
  disclaimer: string
  isDemo: boolean
}

export const LimitationsPanel: React.FC<LimitationsPanelProps> = ({
  limitations,
  disclaimer,
  isDemo,
}) => {
  return (
    <section className="limitations-container">
      <div className="section-header-row">
        <div>
          <h2 className="section-title">5. System Limitations & Safety Guardrails</h2>
          <p className="section-desc">
            Production-readiness constraints, sandbox safety boundaries, and compliance disclosures.
          </p>
        </div>
        {isDemo && <span className="badge badge-demo">DISCLOSURE</span>}
      </div>

      <div className="disclosure-banner">
        <div className="disclosure-icon">⚠️</div>
        <div className="disclosure-body">
          <h4 className="disclosure-title">
            {isDemo ? 'Evaluation Notice: Heuristic Simulation Mode' : 'Live Agent Execution'}
          </h4>
          <p className="disclosure-text">{disclaimer}</p>
        </div>
      </div>

      <div className="limitations-card">
        <h4 className="limitations-heading">Operational Guardrails & Boundaries:</h4>
        <ul className="limitations-list">
          {limitations.map((item, idx) => (
            <li key={idx} className="limitation-item">
              <span className="limitation-bullet">🛡️</span>
              <span className="limitation-text">{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
