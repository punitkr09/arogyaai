import type { HealthResponse } from '../types/workflow'

interface HeaderProps {
  health: HealthResponse | null
  healthLoading: boolean
  onNavigateToSettings?: () => void
}

export function Header({ health, healthLoading, onNavigateToSettings }: HeaderProps) {
  const aiProviderName = health?.ai_provider?.provider === 'ollama'
    ? `Ollama (${health.ai_provider.model})`
    : health?.ai_provider?.provider === 'openai'
    ? `OpenAI (${health.ai_provider.model})`
    : 'Semantic Engine'

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
          {/* AI Provider Status */}
          <span
            className="badge"
            style={{
              backgroundColor: 'var(--bg-card-subtle)',
              border: '1px solid var(--border-medium)',
              color: 'var(--text-main)',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.72rem',
            }}
            title="Active Intelligence Layer"
          >
            <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#2563eb', display: 'inline-block' }}></span>
            AI: {aiProviderName}
          </span>

          {/* Backend Status */}
          {healthLoading ? (
            <span className="badge" style={{ backgroundColor: '#f1f5f9', color: '#64748b' }}>
              Connecting...
            </span>
          ) : health?.status === 'ok' ? (
            <span className="badge badge-online">
              <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#166534', display: 'inline-block' }}></span>
              Backend Online (v{health.version})
            </span>
          ) : (
            <span className="badge" style={{ backgroundColor: '#fee2e2', color: '#991b1b' }}>
              Backend Offline
            </span>
          )}

          {/* Qualified Person Role Badge */}
          <span
            className="badge"
            style={{
              backgroundColor: '#eff6ff',
              color: '#1e40af',
              border: '1px solid #bfdbfe',
              fontWeight: 600,
            }}
          >
            Role: Qualified Person (R.Ph)
          </span>

          {onNavigateToSettings && (
            <button
              onClick={onNavigateToSettings}
              className="btn-secondary"
              title="System Settings & Data Management"
              style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem' }}
            >
              ⚙️ Settings
            </button>
          )}
        </div>
      </div>
    </header>
  )
}
