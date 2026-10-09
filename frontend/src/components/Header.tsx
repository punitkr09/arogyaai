import type { HealthResponse } from '../types/workflow'

interface HeaderProps {
  health: HealthResponse | null
  healthLoading: boolean
  onResetDemo: () => void
  resetting: boolean
}

export function Header({ health, healthLoading, onResetDemo, resetting }: HeaderProps) {
  return (
    <header className="app-header">
      <div className="header-inner">
        <div className="brand-section">
          <div className="brand-icon">
            <span>+</span>
          </div>
          <div className="brand-titles">
            <h1>Arogya AI</h1>
            <p>Pharmaceutical Inventory Intelligence & Autonomous Operations Agent</p>
          </div>
        </div>

        <div className="header-badges">
          <span className="badge badge-demo">
            DEMO SIMULATION
          </span>

          {healthLoading ? (
            <span className="badge" style={{ backgroundColor: '#f1f5f9', color: '#64748b' }}>
              Connecting...
            </span>
          ) : health?.status === 'ok' ? (
            <span className="badge badge-online">
              <span style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: '#166534', display: 'inline-block' }}></span>
              Backend Online (v{health.version})
            </span>
          ) : (
            <span className="badge" style={{ backgroundColor: '#fee2e2', color: '#991b1b' }}>
              Offline
            </span>
          )}

          <button
            onClick={onResetDemo}
            disabled={resetting}
            className="btn-secondary"
            title="Reset synthetic SQLite records to clean baseline"
          >
            {resetting ? 'Resetting...' : '↺ Reset Demo Data'}
          </button>
        </div>
      </div>
    </header>
  )
}
