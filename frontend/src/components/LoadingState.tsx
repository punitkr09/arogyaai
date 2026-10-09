import React, { useEffect, useState } from 'react'

const STAGE_HINTS = [
  { name: 'Planner Agent', desc: 'Decomposing problem statement into structured sub-tasks...' },
  { name: 'Executor Agent', desc: 'Synthesizing code architecture and runtime components...' },
  { name: 'Verifier Agent', desc: 'Running invariant assertions and edge-case diagnostics...' },
  { name: 'Repair Agent', desc: 'Applying automated self-healing patch and regression testing...' },
]

export const LoadingState: React.FC = () => {
  const [activeStageIndex, setActiveStageIndex] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveStageIndex((prev) => (prev + 1) % STAGE_HINTS.length)
    }, 450)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="loading-state-card">
      <div className="loading-spinner-ring" />
      <h3 className="loading-title">Orchestrating Agentic Workflow</h3>
      <p className="loading-stage-name">{STAGE_HINTS[activeStageIndex].name}</p>
      <p className="loading-stage-desc">{STAGE_HINTS[activeStageIndex].desc}</p>

      <div className="loading-progress-bar-wrap">
        <div
          className="loading-progress-bar-fill"
          style={{ width: `${((activeStageIndex + 1) / STAGE_HINTS.length) * 100}%` }}
        />
      </div>

      <div className="loading-badges">
        <span className="badge badge-demo">DEMO SIMULATION ACTIVE</span>
        <span className="badge badge-neutral">Async Processing</span>
      </div>
    </div>
  )
}
