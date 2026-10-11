import { useState } from 'react'
import type { HealthResponse } from '../types/workflow'
import type { AIStatusResponse } from '../services/api'
import { ArogyaLogoIcon, MenuIcon, SettingsIcon, CloseIcon, SunIcon, MoonIcon } from './Icons'

interface HeaderProps {
  health: HealthResponse | null
  healthLoading: boolean
  aiStatus?: AIStatusResponse | null
  theme?: 'dark' | 'light'
  onToggleTheme?: () => void
  onOpenOfflineModelModal: () => void
  onNavigateToSettings?: () => void
  onToggleMobileSidebar?: () => void
}

export function Header({
  health,
  healthLoading,
  aiStatus,
  theme = 'dark',
  onToggleTheme,
  onOpenOfflineModelModal,
  onNavigateToSettings,
  onToggleMobileSidebar,
}: HeaderProps) {
  const [showRoleInfo, setShowRoleInfo] = useState<boolean>(false)

  // Determine dynamic AI model status display
  const isAiOnline = aiStatus ? (aiStatus.is_online && aiStatus.model_available) : (health?.ai_provider?.is_online ?? false)
  const aiModelName = aiStatus?.model || health?.ai_provider?.model || 'qwen2.5-coder:7b'
  const aiProviderName = aiStatus?.provider || health?.ai_provider?.provider || 'ollama'

  const aiStatusText = isAiOnline
    ? `AI: ${aiProviderName} (${aiModelName})`
    : aiStatus?.is_online && !aiStatus?.model_available
    ? `AI: Model Missing (${aiModelName})`
    : `AI: Offline (${aiModelName})`

  const aiDotColor = isAiOnline
    ? '#10b981'
    : aiStatus?.is_online && !aiStatus?.model_available
    ? '#f59e0b'
    : '#ef4444'

  return (
    <header className="app-header">
      <div className="header-inner">
        {/* Left Section: Mobile Menu + Brand */}
        <div className="brand-section">
          {onToggleMobileSidebar && (
            <button
              className="mobile-menu-toggle"
              onClick={onToggleMobileSidebar}
              aria-label="Toggle navigation menu"
              title="Menu"
            >
              <MenuIcon size={20} />
            </button>
          )}

          <div className="brand-icon" style={{ padding: 2 }}>
            <ArogyaLogoIcon size={32} />
          </div>

          <div className="brand-titles">
            <h1>Arogya AI</h1>
            <p>Pharmaceutical Operations & Autonomous Intelligence</p>
          </div>
        </div>

        {/* Right Section: Status Badges and Quick Controls */}
        <div className="header-badges">
          {/* AI Provider Status Button -> Opens "Offline Model Required" Modal */}
          <button
            onClick={onOpenOfflineModelModal}
            className="badge badge-interactive"
            style={{
              backgroundColor: 'var(--bg-card-subtle)',
              border: `1px solid ${isAiOnline ? 'var(--status-success-border)' : 'var(--status-warning-border)'}`,
              color: 'var(--text-main)',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.74rem',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              padding: '0.3rem 0.75rem',
              borderRadius: '9999px',
              transition: 'all 0.15s ease',
            }}
            title="Click to check Ollama offline model status & connection instructions"
            aria-label="AI Model Status. Click to configure Offline Model"
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                backgroundColor: aiDotColor,
                display: 'inline-block',
                boxShadow: `0 0 0 2px ${aiDotColor}33`,
              }}
            />
            <span>{aiStatusText}</span>
          </button>

          {/* Backend Status */}
          {healthLoading ? (
            <span
              className="badge"
              style={{ backgroundColor: 'var(--bg-tag)', color: 'var(--text-muted)' }}
              title="Connecting to backend API..."
            >
              Connecting...
            </span>
          ) : health?.status === 'ok' ? (
            <span
              className="badge badge-online"
              title={`FastAPI Service Online (v${health.version}) on SQLite Persistence`}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  backgroundColor: '#166534',
                  display: 'inline-block',
                }}
              />
              Backend Online (v{health.version})
            </span>
          ) : (
            <span
              className="badge"
              style={{ backgroundColor: 'var(--status-critical-bg)', color: 'var(--status-critical-text)' }}
              title="Backend service unreachable"
            >
              Backend Offline
            </span>
          )}

          {/* Qualified Person Role Badge with interactive modal disclosure */}
          <button
            onClick={() => setShowRoleInfo(true)}
            className="badge badge-interactive"
            style={{
              backgroundColor: 'var(--accent-primary-light)',
              color: 'var(--accent-primary)',
              border: '1px solid var(--accent-primary-border)',
              fontWeight: 600,
              fontSize: '0.74rem',
              padding: '0.3rem 0.75rem',
              borderRadius: '9999px',
              cursor: 'pointer',
            }}
            title="Regulatory Role: Qualified Person (R.Ph). Click to view authority."
          >
            Role: Qualified Person (R.Ph)
          </button>

          {/* Theme Preference Toggle Button */}
          {onToggleTheme && (
            <button
              onClick={onToggleTheme}
              className="theme-toggle-btn"
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              aria-label={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {theme === 'dark' ? (
                <>
                  <SunIcon size={14} color="#facc15" />
                  <span>Light Mode</span>
                </>
              ) : (
                <>
                  <MoonIcon size={14} color="#6366f1" />
                  <span>Dark Mode</span>
                </>
              )}
            </button>
          )}

          {/* Settings Navigation */}
          {onNavigateToSettings && (
            <button
              onClick={onNavigateToSettings}
              className="btn-secondary"
              title="System Settings & Data Management"
              style={{ fontSize: '0.76rem', padding: '0.3rem 0.7rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
            >
              <SettingsIcon size={14} /> Settings
            </button>
          )}
        </div>
      </div>

      {/* Role Information Modal */}
      {showRoleInfo && (
        <div
          className="modal-overlay"
          onClick={() => setShowRoleInfo(false)}
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 110,
            padding: '1rem',
          }}
        >
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: 480,
              width: '100%',
              backgroundColor: 'var(--bg-surface)',
              borderRadius: 10,
              padding: '1.25rem',
              border: '1px solid var(--border-medium)',
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <h3 style={{ fontSize: '1.05rem', margin: 0, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                Qualified Person (R.Ph) Authorization
              </h3>
              <button
                onClick={() => setShowRoleInfo(false)}
                className="btn-secondary"
                style={{ width: 28, height: 28, padding: 0, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                aria-label="Close dialog"
              >
                <CloseIcon size={14} />
              </button>
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.5, margin: '0 0 1rem 0' }}>
              Under Good Distribution Practice (GDP) and EU/WHO Guidelines, the Qualified Person (QP) holds statutory legal responsibility for batch releases, quarantine holds, recall escalations, and critical medicines continuity.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.8rem' }}>
              <div style={{ padding: '0.65rem 0.85rem', backgroundColor: 'rgba(16, 185, 129, 0.12)', borderRadius: 6, border: '1px solid rgba(16, 185, 129, 0.25)', color: 'var(--text-main)' }}>
                <strong style={{ color: '#34d399' }}>Authorized Sign-off:</strong> Autonomous agent proposals are held at approval gate until signed off by the Qualified Person.
              </div>
              <div style={{ padding: '0.65rem 0.85rem', backgroundColor: 'var(--status-info-bg)', borderRadius: 6, border: '1px solid var(--status-info-border)', color: 'var(--text-main)' }}>
                <strong style={{ color: 'var(--accent-primary)' }}>Traceability & Audit:</strong> Every decision records timestamp, cryptographic run ID, and reason in the permanent SQLite audit ledger.
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
              <button className="btn-primary" onClick={() => setShowRoleInfo(false)} style={{ fontSize: '0.8rem', padding: '0.4rem 0.9rem' }}>
                Understood
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
