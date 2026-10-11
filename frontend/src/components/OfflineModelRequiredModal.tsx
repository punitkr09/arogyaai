import { useEffect, useState, useCallback, useRef } from 'react'
import { fetchAIStatus, type AIStatusResponse } from '../services/api'
import { AgentIcon, CheckIcon, CloseIcon, RefreshIcon } from './Icons'

interface OfflineModelRequiredModalProps {
  isOpen: boolean
  onClose: () => void
  onStatusChange?: (status: AIStatusResponse | null) => void
}

type DynamicStatus =
  | 'Checking connection'
  | 'Connected — model available'
  | 'Offline — Ollama unavailable'
  | 'Model missing or unavailable'
  | 'Backend unavailable'

export function OfflineModelRequiredModal({
  isOpen,
  onClose,
  onStatusChange,
}: OfflineModelRequiredModalProps) {
  const [status, setStatus] = useState<AIStatusResponse | null>(null)
  const [loading, setLoading] = useState<boolean>(false)
  const [displayStatus, setDisplayStatus] = useState<DynamicStatus>('Checking connection')
  const [showInstructions, setShowInstructions] = useState<boolean>(false)
  const [selectedOS, setSelectedOS] = useState<'linux' | 'macos' | 'windows'>('linux')
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null)

  const onStatusChangeRef = useRef(onStatusChange)
  useEffect(() => {
    onStatusChangeRef.current = onStatusChange
  }, [onStatusChange])

  const checkConnection = useCallback(async () => {
    setLoading(true)
    setDisplayStatus('Checking connection')
    try {
      const res = await fetchAIStatus()
      setStatus(res)
      if (res.is_online && res.model_available) {
        setDisplayStatus('Connected — model available')
      } else if (res.is_online && !res.model_available) {
        setDisplayStatus('Model missing or unavailable')
      } else {
        setDisplayStatus('Offline — Ollama unavailable')
      }
      onStatusChangeRef.current?.(res)
    } catch {
      setStatus(null)
      setDisplayStatus('Backend unavailable')
      onStatusChangeRef.current?.(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isOpen) {
      checkConnection()
    }
  }, [isOpen, checkConnection])

  // Keyboard navigation & Escape key support
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const configuredModel = status?.model || 'qwen2.5-coder:7b'
  const isOnlineAndReady = displayStatus === 'Connected — model available'

  const copyToClipboard = (text: string) => {
    navigator.clipboard?.writeText(text)
    setCopiedCmd(text)
    setTimeout(() => setCopiedCmd(null), 2000)
  }

  const getStatusBadgeStyle = () => {
    switch (displayStatus) {
      case 'Connected — model available':
        return {
          bg: 'var(--status-success-bg, rgba(16, 185, 129, 0.16))',
          text: 'var(--status-success-text, #34d399)',
          border: 'var(--status-success-border, rgba(16, 185, 129, 0.3))',
          dot: '#10b981',
        }
      case 'Checking connection':
        return {
          bg: '#1e293b',
          text: '#94a3b8',
          border: '#334155',
          dot: '#94a3b8',
        }
      case 'Model missing or unavailable':
        return {
          bg: 'var(--status-warning-bg, rgba(245, 158, 11, 0.16))',
          text: 'var(--status-warning-text, #fbbf24)',
          border: 'var(--status-warning-border, rgba(245, 158, 11, 0.3))',
          dot: '#f59e0b',
        }
      case 'Offline — Ollama unavailable':
      case 'Backend unavailable':
      default:
        return {
          bg: 'var(--status-critical-bg, rgba(239, 68, 68, 0.16))',
          text: 'var(--status-critical-text, #f87171)',
          border: 'var(--status-critical-border, rgba(239, 68, 68, 0.3))',
          dot: '#ef4444',
        }
    }
  }

  const badgeStyle = getStatusBadgeStyle()

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="offline-model-dialog-title"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(5px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        padding: '1rem',
      }}
    >
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderRadius: '12px',
          boxShadow: 'var(--shadow-lg)',
          maxWidth: '620px',
          width: '100%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          border: '1px solid var(--border-medium)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'var(--bg-card-subtle)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 8,
                backgroundColor: 'var(--accent-primary-light)',
                color: 'var(--accent-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid var(--accent-primary-border)',
              }}
            >
              <AgentIcon size={22} color="var(--accent-primary)" />
            </div>
            <div>
              <h2
                id="offline-model-dialog-title"
                style={{
                  fontSize: '1.2rem',
                  fontWeight: 700,
                  color: 'var(--text-main)',
                  margin: 0,
                }}
              >
                Offline Model Required
              </h2>
              <p
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--text-muted)',
                  margin: '0.15rem 0 0 0',
                }}
              >
                Local Inference Engine &bull; Zero Cloud Dependency
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="btn-secondary"
            style={{
              width: 32,
              height: 32,
              padding: 0,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid var(--border-subtle)',
              background: 'transparent',
              fontSize: '1rem',
              cursor: 'pointer',
            }}
          >
            <CloseIcon size={14} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div
          style={{
            padding: '1.5rem',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
            fontSize: '0.875rem',
            lineHeight: 1.5,
          }}
        >
          {/* Main Description */}
          <p style={{ color: 'var(--text-main)', margin: 0 }}>
            Arogya AI uses a local AI model through Ollama to power its operations assistant. Start
            Ollama and ensure the configured model is installed and running to enable AI-powered
            analysis, natural-language questions, recommendations, and operational assistance.
          </p>

          {/* Dynamic Status Box */}
          <div
            style={{
              padding: '1rem',
              borderRadius: 8,
              backgroundColor: badgeStyle.bg,
              border: `1px solid ${badgeStyle.border}`,
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    backgroundColor: badgeStyle.dot,
                    display: 'inline-block',
                    boxShadow: `0 0 0 3px ${badgeStyle.border}`,
                  }}
                />
                <span
                  style={{
                    fontWeight: 700,
                    color: badgeStyle.text,
                    fontSize: '0.9rem',
                  }}
                >
                  {displayStatus}
                </span>
              </div>

              {status?.latency_ms !== undefined && (
                <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: badgeStyle.text }}>
                  {status.latency_ms}ms latency
                </span>
              )}
            </div>

            <div style={{ fontSize: '0.78rem', color: badgeStyle.text, opacity: 0.9 }}>
              Configured Model:{' '}
              <strong style={{ fontFamily: 'var(--font-mono)' }}>{configuredModel}</strong> &bull;
              Provider: <strong style={{ fontFamily: 'var(--font-mono)' }}>{status?.provider || 'ollama'}</strong>
            </div>

            {status?.available_models && status.available_models.length > 0 && (
              <div style={{ fontSize: '0.75rem', color: badgeStyle.text, marginTop: '0.25rem' }}>
                Locally Installed Models: {status.available_models.join(', ')}
              </div>
            )}
          </div>

          {/* Setup Checklist */}
          <div
            style={{
              background: 'var(--bg-card-subtle)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 8,
              padding: '1rem',
            }}
          >
            <h3
              style={{
                fontSize: '0.85rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                color: 'var(--text-muted)',
                margin: '0 0 0.75rem 0',
              }}
            >
              Setup checklist
            </h3>
            <ul
              style={{
                listStyle: 'none',
                padding: 0,
                margin: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
                fontSize: '0.82rem',
              }}
            >
              <li style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <span style={{ color: status?.is_online ? '#34d399' : 'var(--text-dim)', display: 'inline-flex' }}>
                  {status?.is_online ? <CheckIcon size={14} color="#34d399" /> : '○'}
                </span>
                <span style={{ color: 'var(--text-main)' }}>Install Ollama if it is not installed.</span>
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <span style={{ color: status?.model_available ? '#34d399' : 'var(--text-dim)', display: 'inline-flex' }}>
                  {status?.model_available ? <CheckIcon size={14} color="#34d399" /> : '○'}
                </span>
                <span style={{ color: 'var(--text-main)' }}>
                  Download the model configured for this application (
                  <code style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--accent-primary)' }}>{configuredModel}</code>).
                </span>
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <span style={{ color: status?.is_online ? '#34d399' : 'var(--text-dim)', display: 'inline-flex' }}>
                  {status?.is_online ? <CheckIcon size={14} color="#34d399" /> : '○'}
                </span>
                <span style={{ color: 'var(--text-main)' }}>Start the Ollama service.</span>
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <span style={{ color: status?.is_online ? '#34d399' : 'var(--text-dim)', display: 'inline-flex' }}>
                  {status?.is_online ? <CheckIcon size={14} color="#34d399" /> : '○'}
                </span>
                <span style={{ color: 'var(--text-main)' }}>Verify that the backend can connect to Ollama.</span>
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <span style={{ color: isOnlineAndReady ? '#34d399' : 'var(--text-dim)', display: 'inline-flex' }}>
                  {isOnlineAndReady ? <CheckIcon size={14} color="#34d399" /> : '○'}
                </span>
                <span style={{ color: 'var(--text-main)' }}>Retry the connection and check the model status.</span>
              </li>
            </ul>
          </div>

          {/* Setup Instructions Collapsible */}
          <div>
            <button
              onClick={() => setShowInstructions((prev) => !prev)}
              className="btn-secondary"
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.6rem 0.85rem',
                fontSize: '0.82rem',
                fontWeight: 600,
                textAlign: 'left',
              }}
            >
              <span>📖 Setup Instructions ({selectedOS.toUpperCase()})</span>
              <span>{showInstructions ? '▲ Hide' : '▼ Expand'}</span>
            </button>

            {showInstructions && (
              <div
                style={{
                  marginTop: '0.75rem',
                  padding: '1rem',
                  borderRadius: 8,
                  backgroundColor: '#1e242b',
                  color: '#f8fafc',
                  fontSize: '0.8rem',
                }}
              >
                {/* OS Selector Tabs */}
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  {(['linux', 'macos', 'windows'] as const).map((os) => (
                    <button
                      key={os}
                      onClick={() => setSelectedOS(os)}
                      style={{
                        padding: '0.25rem 0.6rem',
                        borderRadius: 4,
                        border: 'none',
                        background: selectedOS === os ? 'var(--accent-terracotta, #c05638)' : '#334155',
                        color: '#fff',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        textTransform: 'capitalize',
                      }}
                    >
                      {os}
                    </button>
                  ))}
                </div>

                {selectedOS === 'linux' && (
                  <div>
                    <p style={{ margin: '0 0 0.5rem 0', color: '#94a3b8' }}>
                      1. Install Ollama via shell script:
                    </p>
                    <div
                      style={{
                        background: '#0f172a',
                        padding: '0.5rem',
                        borderRadius: 4,
                        fontFamily: 'var(--font-mono)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '0.75rem',
                      }}
                    >
                      <code>curl -fsSL https://ollama.com/install.sh | sh</code>
                      <button
                        onClick={() => copyToClipboard('curl -fsSL https://ollama.com/install.sh | sh')}
                        style={{ background: 'transparent', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', fontSize: '0.75rem' }}
                      >
                        {copiedCmd === 'curl -fsSL https://ollama.com/install.sh | sh' ? 'Copied!' : 'Copy'}
                      </button>
                    </div>

                    <p style={{ margin: '0 0 0.5rem 0', color: '#94a3b8' }}>
                      2. Pull the configured model:
                    </p>
                    <div
                      style={{
                        background: '#0f172a',
                        padding: '0.5rem',
                        borderRadius: 4,
                        fontFamily: 'var(--font-mono)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '0.75rem',
                      }}
                    >
                      <code>ollama pull {configuredModel}</code>
                      <button
                        onClick={() => copyToClipboard(`ollama pull ${configuredModel}`)}
                        style={{ background: 'transparent', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', fontSize: '0.75rem' }}
                      >
                        {copiedCmd === `ollama pull ${configuredModel}` ? 'Copied!' : 'Copy'}
                      </button>
                    </div>

                    <p style={{ margin: '0 0 0.5rem 0', color: '#94a3b8' }}>
                      3. Ensure systemd service is active:
                    </p>
                    <div
                      style={{
                        background: '#0f172a',
                        padding: '0.5rem',
                        borderRadius: 4,
                        fontFamily: 'var(--font-mono)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <code>systemctl is-active ollama || ollama serve</code>
                      <button
                        onClick={() => copyToClipboard('systemctl is-active ollama || ollama serve')}
                        style={{ background: 'transparent', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', fontSize: '0.75rem' }}
                      >
                        {copiedCmd === 'systemctl is-active ollama || ollama serve' ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                  </div>
                )}

                {selectedOS === 'macos' && (
                  <div>
                    <p style={{ margin: '0 0 0.5rem 0', color: '#94a3b8' }}>
                      1. Install Ollama via Homebrew or DMG:
                    </p>
                    <div
                      style={{
                        background: '#0f172a',
                        padding: '0.5rem',
                        borderRadius: 4,
                        fontFamily: 'var(--font-mono)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '0.75rem',
                      }}
                    >
                      <code>brew install ollama && brew services start ollama</code>
                      <button
                        onClick={() => copyToClipboard('brew install ollama && brew services start ollama')}
                        style={{ background: 'transparent', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', fontSize: '0.75rem' }}
                      >
                        {copiedCmd === 'brew install ollama && brew services start ollama' ? 'Copied!' : 'Copy'}
                      </button>
                    </div>

                    <p style={{ margin: '0 0 0.5rem 0', color: '#94a3b8' }}>
                      2. Download the configured model:
                    </p>
                    <div
                      style={{
                        background: '#0f172a',
                        padding: '0.5rem',
                        borderRadius: 4,
                        fontFamily: 'var(--font-mono)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <code>ollama pull {configuredModel}</code>
                      <button
                        onClick={() => copyToClipboard(`ollama pull ${configuredModel}`)}
                        style={{ background: 'transparent', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', fontSize: '0.75rem' }}
                      >
                        {copiedCmd === `ollama pull ${configuredModel}` ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                  </div>
                )}

                {selectedOS === 'windows' && (
                  <div>
                    <p style={{ margin: '0 0 0.5rem 0', color: '#94a3b8' }}>
                      1. Download Ollama for Windows from official site:
                    </p>
                    <div
                      style={{
                        background: '#0f172a',
                        padding: '0.5rem',
                        borderRadius: 4,
                        fontFamily: 'var(--font-mono)',
                        marginBottom: '0.75rem',
                      }}
                    >
                      <code>https://ollama.com/download/windows</code>
                    </div>

                    <p style={{ margin: '0 0 0.5rem 0', color: '#94a3b8' }}>
                      2. In PowerShell or Command Prompt, pull the model:
                    </p>
                    <div
                      style={{
                        background: '#0f172a',
                        padding: '0.5rem',
                        borderRadius: 4,
                        fontFamily: 'var(--font-mono)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <code>ollama run {configuredModel}</code>
                      <button
                        onClick={() => copyToClipboard(`ollama run ${configuredModel}`)}
                        style={{ background: 'transparent', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', fontSize: '0.75rem' }}
                      >
                        {copiedCmd === `ollama run ${configuredModel}` ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Operational Continuity Clarification */}
          <div
            style={{
              padding: '0.75rem',
              borderRadius: 6,
              backgroundColor: 'rgba(56, 189, 248, 0.08)',
              border: '1px solid rgba(56, 189, 248, 0.2)',
              fontSize: '0.78rem',
              color: 'var(--text-muted)',
            }}
          >
            <strong style={{ color: 'var(--text-main)' }}>Non-AI Operational Features Active:</strong>{' '}
            If Ollama is offline, core pharmaceutical operations (Master Formulary, Physical Inventory Batches,
            Healthcare Customers, Outbound Dispatches, Regulatory Recall Quarantine, Cold-Chain telemetry, and
            Qualified Person Approvals) remain 100% functional with deterministic database rules.
          </div>
        </div>

        {/* Footer Actions */}
        <div
          style={{
            padding: '1rem 1.5rem',
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.75rem',
            backgroundColor: 'var(--bg-card-subtle)',
          }}
        >
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={checkConnection}
              disabled={loading}
              className="btn-primary"
              style={{
                fontSize: '0.8rem',
                padding: '0.45rem 0.9rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
            >
              {loading ? (
                <>
                  <span style={{ animation: 'spin 1s infinite linear', display: 'inline-block' }}>⟳</span>
                  Checking...
                </>
              ) : (
                <>
                  <RefreshIcon size={14} /> Check Connection
                </>
              )}
            </button>

            <button
              onClick={checkConnection}
              disabled={loading}
              className="btn-secondary"
              style={{ fontSize: '0.8rem', padding: '0.45rem 0.85rem' }}
            >
              Retry Connection
            </button>
          </div>

          <button
            onClick={onClose}
            className="btn-secondary"
            style={{
              fontSize: '0.8rem',
              padding: '0.45rem 1rem',
              fontWeight: 600,
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
