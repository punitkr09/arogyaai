import { useState } from 'react'
import type { HealthResponse } from '../types/workflow'
import type { AIStatusResponse } from '../services/api'
import type { LocalAIStatus } from '../types/arogya'
import {
  ArogyaLogoIcon,
  MenuIcon,
  SettingsIcon,
  CloseIcon,
  SunIcon,
  MoonIcon,
  RefreshIcon,
  AgentIcon,
} from './Icons'

interface HeaderProps {
  health: HealthResponse | null
  healthLoading: boolean
  aiStatus?: AIStatusResponse | null
  localAiStatus?: LocalAIStatus | null
  onRetryLocalAi?: () => void
  isRetryingLocalAi?: boolean
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
  localAiStatus,
  onRetryLocalAi,
  isRetryingLocalAi = false,
  theme = 'dark',
  onToggleTheme,
  onOpenOfflineModelModal,
  onNavigateToSettings,
  onToggleMobileSidebar,
}: HeaderProps) {
  const [showRoleInfo, setShowRoleInfo] = useState<boolean>(false)
  const [showAiInfoModal, setShowAiInfoModal] = useState<boolean>(false)
  const [dismissOfflineBanner, setDismissOfflineBanner] = useState<boolean>(false)

  // Prioritize client-side local Ollama status; fallback to backend AI health
  const isLocalConnected = localAiStatus
    ? localAiStatus.state === 'local_ai_connected'
    : (aiStatus?.is_online && aiStatus?.model_available) || Boolean(health?.ai_provider?.is_online)

  const isModelMissing = localAiStatus?.state === 'model_missing' || (aiStatus?.is_online && !aiStatus?.model_available)
  const isChecking = localAiStatus?.state === 'checking_local_ai' || isRetryingLocalAi
  const isSecurityBlocked = localAiStatus?.state === 'local_connection_blocked_by_browser_security'

  const configuredModel = localAiStatus?.model || aiStatus?.model || health?.ai_provider?.model || 'qwen2.5-coder:7b'

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
            <p>Pharmaceutical Operations &amp; Autonomous Intelligence</p>
          </div>
        </div>

        {/* Right Section: Status Badges and Quick Controls */}
        <div className="header-badges">
          {/* AI Status Badges: Mode A vs Mode B */}
          {isLocalConnected ? (
            <>
              {/* Badge 1: AI: Local — Connected */}
              <button
                onClick={() => setShowAiInfoModal(true)}
                className="badge badge-interactive"
                style={{
                  backgroundColor: 'var(--status-success-bg, rgba(16, 185, 129, 0.14))',
                  border: '1px solid var(--status-success-border, rgba(16, 185, 129, 0.4))',
                  color: 'var(--status-success-text, #34d399)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.74rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  padding: '0.3rem 0.75rem',
                  borderRadius: '9999px',
                }}
                title="Click to view Local AI status details"
              >
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    backgroundColor: '#10b981',
                    display: 'inline-block',
                    boxShadow: '0 0 0 2px rgba(16, 185, 129, 0.3)',
                  }}
                />
                <span>AI: Local — Connected</span>
              </button>

              {/* Badge 2: Model: qwen2.5-coder:7b */}
              <button
                onClick={() => setShowAiInfoModal(true)}
                className="badge badge-interactive"
                style={{
                  backgroundColor: 'var(--bg-card-subtle)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-main)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.74rem',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.3rem 0.65rem',
                  borderRadius: '9999px',
                }}
                title="Configured local inference model"
              >
                <span>Model: {configuredModel}</span>
              </button>

              {/* Badge 3: Mode: Local AI */}
              <button
                onClick={() => setShowAiInfoModal(true)}
                className="badge badge-interactive"
                style={{
                  backgroundColor: 'rgba(99, 102, 241, 0.12)',
                  border: '1px solid rgba(99, 102, 241, 0.35)',
                  color: '#818cf8',
                  fontWeight: 700,
                  fontSize: '0.74rem',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '0.3rem 0.65rem',
                  borderRadius: '9999px',
                }}
                title="AI reasoning is running locally on your workstation"
              >
                <span>Mode: Local AI</span>
              </button>
            </>
          ) : (
            <>
              {/* Badge 1: AI: Offline (or Checking / Model Missing) */}
              <button
                onClick={() => setShowAiInfoModal(true)}
                className="badge badge-interactive"
                style={{
                  backgroundColor: isChecking
                    ? '#1e293b'
                    : isModelMissing
                    ? 'var(--status-warning-bg, rgba(245, 158, 11, 0.14))'
                    : 'var(--status-critical-bg, rgba(239, 68, 68, 0.14))',
                  border: `1px solid ${
                    isChecking
                      ? '#334155'
                      : isModelMissing
                      ? 'var(--status-warning-border, rgba(245, 158, 11, 0.4))'
                      : 'var(--status-critical-border, rgba(239, 68, 68, 0.4))'
                  }`,
                  color: isChecking
                    ? '#94a3b8'
                    : isModelMissing
                    ? 'var(--status-warning-text, #fbbf24)'
                    : 'var(--status-critical-text, #f87171)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.74rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  padding: '0.3rem 0.75rem',
                  borderRadius: '9999px',
                }}
                title="Click for Local AI status information"
              >
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    backgroundColor: isChecking ? '#94a3b8' : isModelMissing ? '#f59e0b' : '#ef4444',
                    display: 'inline-block',
                    boxShadow: `0 0 0 2px ${isChecking ? '#94a3b844' : isModelMissing ? '#f59e0b44' : '#ef444444'}`,
                  }}
                />
                <span>{isChecking ? 'Checking local AI...' : isModelMissing ? 'AI: Model Missing' : 'AI: Offline'}</span>
              </button>

              {/* Badge 2: Mode: Dataset Fallback */}
              <button
                onClick={() => setShowAiInfoModal(true)}
                className="badge badge-interactive"
                style={{
                  backgroundColor: 'var(--bg-card-subtle)',
                  border: '1px solid var(--border-medium)',
                  color: 'var(--text-muted)',
                  fontSize: '0.74rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '0.3rem 0.65rem',
                  borderRadius: '9999px',
                }}
                title="Operating safely with deterministic pharmaceutical datasets"
              >
                <span>Mode: Dataset Fallback</span>
              </button>

              {/* Button: Retry Local AI Connection */}
              {onRetryLocalAi && (
                <button
                  onClick={onRetryLocalAi}
                  disabled={isChecking}
                  className="btn-secondary"
                  style={{
                    fontSize: '0.74rem',
                    padding: '0.28rem 0.65rem',
                    borderRadius: '9999px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    border: '1px solid var(--accent-primary-border, #4f46e5)',
                    color: 'var(--accent-primary, #6366f1)',
                    backgroundColor: 'transparent',
                    cursor: isChecking ? 'not-allowed' : 'pointer',
                  }}
                  title="Retry connection to local Ollama instance"
                >
                  <RefreshIcon size={12} className={isChecking ? 'spin-icon' : ''} />
                  <span>{isChecking ? 'Checking...' : 'Retry Local AI Connection'}</span>
                </button>
              )}
            </>
          )}

          {/* Backend Status: Decoupled from AI health */}
          {healthLoading ? (
            <span
              className="badge"
              style={{ backgroundColor: 'var(--bg-tag)', color: 'var(--text-muted)' }}
              title="Connecting to FastAPI backend API..."
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
              title="FastAPI backend service unreachable on Render"
            >
              Backend Offline
            </span>
          )}

          {/* Qualified Person Role Badge */}
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

          {/* Theme Preference Toggle */}
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

      {/* Disconnected Informational Notice */}
      {!isLocalConnected && !dismissOfflineBanner && (
        <div
          style={{
            backgroundColor: 'var(--bg-card-subtle)',
            borderBottom: '1px solid var(--border-subtle)',
            padding: '0.4rem 1.25rem',
            fontSize: '0.78rem',
            color: 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ color: '#f59e0b' }}>ℹ️</span>
            <span>
              <strong>Your local AI model is offline.</strong> Arogya AI is using its available pharmaceutical datasets and operational tools. Start Ollama to enable AI-powered assistance.
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
            {onRetryLocalAi && (
              <button
                onClick={onRetryLocalAi}
                disabled={isChecking}
                style={{
                  fontSize: '0.74rem',
                  padding: '0.2rem 0.55rem',
                  borderRadius: 4,
                  border: '1px solid var(--border-medium)',
                  background: 'var(--bg-surface)',
                  color: 'var(--text-main)',
                  cursor: isChecking ? 'not-allowed' : 'pointer',
                }}
              >
                {isChecking ? 'Checking...' : 'Retry Local AI Connection'}
              </button>
            )}
            <button
              onClick={onOpenOfflineModelModal}
              style={{
                fontSize: '0.74rem',
                padding: '0.2rem 0.55rem',
                borderRadius: 4,
                border: '1px solid var(--accent-primary-border)',
                background: 'var(--accent-primary-light)',
                color: 'var(--accent-primary)',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              Setup Guide...
            </button>
            <button
              onClick={() => setDismissOfflineBanner(true)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-dim)',
                cursor: 'pointer',
                fontSize: '0.85rem',
                padding: '0 0.25rem',
              }}
              title="Dismiss notification"
              aria-label="Dismiss notification"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Local AI Architecture & Status Modal Popup */}
      {showAiInfoModal && (
        <div
          className="modal-overlay"
          onClick={() => setShowAiInfoModal(false)}
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
              maxWidth: 540,
              width: '100%',
              backgroundColor: 'var(--bg-surface)',
              borderRadius: 10,
              padding: '1.35rem',
              border: '1px solid var(--border-medium)',
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AgentIcon size={20} color="var(--accent-primary)" />
                <h3 style={{ fontSize: '1.05rem', margin: 0, color: 'var(--text-main)', fontWeight: 700 }}>
                  Arogya AI Inference Architecture &amp; Status
                </h3>
              </div>
              <button
                onClick={() => setShowAiInfoModal(false)}
                className="btn-secondary"
                style={{ width: 28, height: 28, padding: 0, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                aria-label="Close dialog"
              >
                <CloseIcon size={14} />
              </button>
            </div>

            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.5, margin: '0 0 1rem 0' }}>
              Arogya AI is architected with a strict privacy-first model: <strong>AI inference runs 100% locally on your machine</strong> using Ollama. When local AI is offline, all operational dashboards, datasets, batch lookups, and deterministic verification tools continue running without interruption.
            </p>

            {/* Current State Diagnostic Box */}
            <div
              style={{
                padding: '0.85rem',
                borderRadius: 8,
                backgroundColor: isLocalConnected ? 'var(--status-success-bg, rgba(16, 185, 129, 0.12))' : 'var(--bg-card-subtle)',
                border: `1px solid ${isLocalConnected ? 'var(--status-success-border, rgba(16, 185, 129, 0.3))' : 'var(--border-subtle)'}`,
                display: 'flex',
                flexDirection: 'column',
                gap: '0.4rem',
                fontSize: '0.8rem',
                marginBottom: '1rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-muted)' }}>Connection State:</span>
                <strong style={{ color: isLocalConnected ? '#34d399' : 'var(--text-main)' }}>
                  {localAiStatus?.stateLabel || (isLocalConnected ? 'Local AI connected' : 'Dataset fallback active')}
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-muted)' }}>Active Operational Mode:</span>
                <strong>{isLocalConnected ? 'Mode A: Local AI' : 'Mode B: Dataset Fallback'}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-muted)' }}>Configured Model:</span>
                <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)' }}>{configuredModel}</code>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-muted)' }}>Local Endpoint:</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.74rem' }}>{localAiStatus?.endpointUrl || 'http://127.0.0.1:11434'}</span>
              </div>
              {localAiStatus?.latencyMs !== undefined && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Loopback Latency:</span>
                  <span>{localAiStatus.latencyMs}ms</span>
                </div>
              )}
            </div>

            {/* Mode Explanations */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.79rem', marginBottom: '1.25rem' }}>
              <div style={{ padding: '0.65rem 0.85rem', backgroundColor: 'var(--bg-card-subtle)', borderRadius: 6, border: '1px solid var(--border-subtle)' }}>
                <strong style={{ color: 'var(--accent-primary)' }}>Mode A (Local AI Connected):</strong> Natural-language planning, executive synthesis, and complex analysis are generated locally on your GPU/CPU via Ollama. Telemetry numbers remain grounded in verified SQLite records.
              </div>
              <div style={{ padding: '0.65rem 0.85rem', backgroundColor: 'var(--bg-card-subtle)', borderRadius: 6, border: '1px solid var(--border-subtle)' }}>
                <strong style={{ color: '#f59e0b' }}>Mode B (Dataset Fallback):</strong> When Ollama is offline or browser security blocks loopback HTTP, Arogya AI answers operational queries using deterministic mathematical logic and actual database records. Zero fabrication of quantities or dates.
              </div>
            </div>

            {isSecurityBlocked && (
              <div style={{ padding: '0.65rem 0.85rem', backgroundColor: 'var(--status-warning-bg, rgba(245, 158, 11, 0.15))', borderRadius: 6, border: '1px solid rgba(245, 158, 11, 0.3)', fontSize: '0.78rem', color: 'var(--text-main)', marginBottom: '1rem' }}>
                <strong>Browser Security Notice:</strong> Because this website is hosted over HTTPS, modern browsers may block unencrypted HTTP requests to <code>127.0.0.1:11434</code>. Run the optional <code>arogya_companion.py</code> service to bridge the connection securely.
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
              {onRetryLocalAi && (
                <button
                  className="btn-secondary"
                  onClick={onRetryLocalAi}
                  disabled={isChecking}
                  style={{ fontSize: '0.8rem', padding: '0.4rem 0.85rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                >
                  <RefreshIcon size={13} className={isChecking ? 'spin-icon' : ''} />
                  {isChecking ? 'Retrying...' : 'Retry Local AI Connection'}
                </button>
              )}

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  className="btn-secondary"
                  onClick={() => {
                    setShowAiInfoModal(false)
                    onOpenOfflineModelModal()
                  }}
                  style={{ fontSize: '0.8rem', padding: '0.4rem 0.85rem' }}
                >
                  Ollama Setup Guide...
                </button>
                <button
                  className="btn-primary"
                  onClick={() => setShowAiInfoModal(false)}
                  style={{ fontSize: '0.8rem', padding: '0.4rem 0.9rem' }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
                <strong style={{ color: 'var(--accent-primary)' }}>Traceability &amp; Audit:</strong> Every decision records timestamp, cryptographic run ID, and reason in the permanent SQLite audit ledger.
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
