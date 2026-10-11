import { useEffect, useState, useCallback, useRef } from 'react'
import { localAiService } from '../services/localAiService'
import type { LocalAIStatus, LocalAIState } from '../types/arogya'
import { AgentIcon, CloseIcon, RefreshIcon } from './Icons'

interface OfflineModelRequiredModalProps {
  isOpen: boolean
  onClose: () => void
  onStatusChange?: (status: LocalAIStatus | null) => void
}

export function OfflineModelRequiredModal({
  isOpen,
  onClose,
  onStatusChange,
}: OfflineModelRequiredModalProps) {
  const [status, setStatus] = useState<LocalAIStatus>(() => localAiService.getStatus())
  const [loading, setLoading] = useState<boolean>(false)
  const [showInstructions, setShowInstructions] = useState<boolean>(true)
  const [instructionTab, setInstructionTab] = useState<'ollama' | 'companion' | 'security'>('ollama')
  const [selectedOS, setSelectedOS] = useState<'linux' | 'macos' | 'windows'>('linux')
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null)

  const onStatusChangeRef = useRef(onStatusChange)
  useEffect(() => {
    onStatusChangeRef.current = onStatusChange
  }, [onStatusChange])

  const checkConnection = useCallback(async () => {
    setLoading(true)
    try {
      const res = await localAiService.checkConnection(true)
      setStatus(res)
      onStatusChangeRef.current?.(res)
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
  const isConnected = status.state === 'local_ai_connected'

  const copyToClipboard = (text: string) => {
    navigator.clipboard?.writeText(text)
    setCopiedCmd(text)
    setTimeout(() => setCopiedCmd(null), 2000)
  }

  const getStatusBadgeStyle = (state: LocalAIState) => {
    switch (state) {
      case 'local_ai_connected':
        return {
          bg: 'var(--status-success-bg, rgba(16, 185, 129, 0.16))',
          text: 'var(--status-success-text, #34d399)',
          border: 'var(--status-success-border, rgba(16, 185, 129, 0.35))',
          dot: '#10b981',
        }
      case 'checking_local_ai':
        return {
          bg: '#1e293b',
          text: '#94a3b8',
          border: '#334155',
          dot: '#94a3b8',
        }
      case 'model_missing':
        return {
          bg: 'var(--status-warning-bg, rgba(245, 158, 11, 0.16))',
          text: 'var(--status-warning-text, #fbbf24)',
          border: 'var(--status-warning-border, rgba(245, 158, 11, 0.35))',
          dot: '#f59e0b',
        }
      case 'local_connection_blocked_by_browser_security':
        return {
          bg: 'rgba(217, 119, 6, 0.16)',
          text: '#f59e0b',
          border: 'rgba(217, 119, 6, 0.35)',
          dot: '#d97706',
        }
      case 'ollama_not_installed_or_not_running':
      case 'local_ai_request_failed':
      case 'dataset_fallback_active':
      default:
        return {
          bg: 'var(--status-critical-bg, rgba(239, 68, 68, 0.16))',
          text: 'var(--status-critical-text, #f87171)',
          border: 'var(--status-critical-border, rgba(239, 68, 68, 0.35))',
          dot: '#ef4444',
        }
    }
  }

  const badgeStyle = getStatusBadgeStyle(status.state)

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
          maxWidth: '680px',
          width: '100%',
          maxHeight: '92vh',
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
                  fontSize: '1.15rem',
                  fontWeight: 700,
                  color: 'var(--text-main)',
                  margin: 0,
                }}
              >
                Local Ollama Intelligence &amp; Fallback Desk
              </h2>
              <p
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--text-muted)',
                  margin: '0.15rem 0 0 0',
                }}
              >
                Private Hardware Inference &bull; Zero Cloud Dependency &bull; Automatic Dataset Fallback
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
            fontSize: '0.85rem',
            lineHeight: 1.5,
          }}
        >
          {/* Main Description */}
          <p style={{ color: 'var(--text-main)', margin: 0 }}>
            Arogya AI is architected to be publicly accessible without requiring cloud AI tokens. It checks whether <strong>Ollama</strong> is running locally on your workstation. When connected, the AI Agent Desk uses your local model (<strong>{configuredModel}</strong>). When disconnected, it automatically switches to <strong>Dataset Fallback Mode</strong> using verified database records.
          </p>

          {/* Dynamic State Machine Display Box */}
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
                    fontSize: '0.92rem',
                  }}
                >
                  {status.stateLabel}
                </span>
              </div>

              {status.latencyMs !== undefined && (
                <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: badgeStyle.text }}>
                  {status.latencyMs}ms latency
                </span>
              )}
            </div>

            <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: badgeStyle.text, opacity: 0.95 }}>
              {status.message}
            </p>

            <div style={{ fontSize: '0.76rem', color: badgeStyle.text, opacity: 0.9, marginTop: '0.2rem' }}>
              Endpoint: <strong style={{ fontFamily: 'var(--font-mono)' }}>{status.endpointUrl}</strong> &bull;
              Configured Model: <strong style={{ fontFamily: 'var(--font-mono)' }}>{configuredModel}</strong>
            </div>

            {status.availableModels && status.availableModels.length > 0 && (
              <div style={{ fontSize: '0.75rem', color: badgeStyle.text, marginTop: '0.15rem' }}>
                Installed Models Found: <strong>{status.availableModels.join(', ')}</strong>
              </div>
            )}
          </div>

          {/* Mode A vs Mode B Notice */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '0.75rem',
              fontSize: '0.78rem',
            }}
          >
            <div
              style={{
                padding: '0.75rem',
                borderRadius: 6,
                backgroundColor: isConnected ? 'rgba(16, 185, 129, 0.1)' : 'var(--bg-card-subtle)',
                border: `1px solid ${isConnected ? 'rgba(16, 185, 129, 0.3)' : 'var(--border-subtle)'}`,
              }}
            >
              <strong style={{ color: isConnected ? '#34d399' : 'var(--text-main)', display: 'block', marginBottom: '0.25rem' }}>
                {isConnected ? '✓ Active: Mode A (Local AI)' : 'Mode A: Local AI Available'}
              </strong>
              <span>Executes reasoning via your local Ollama instance ({configuredModel}). Grounded in database facts.</span>
            </div>

            <div
              style={{
                padding: '0.75rem',
                borderRadius: 6,
                backgroundColor: !isConnected ? 'rgba(245, 158, 11, 0.1)' : 'var(--bg-card-subtle)',
                border: `1px solid ${!isConnected ? 'rgba(245, 158, 11, 0.3)' : 'var(--border-subtle)'}`,
              }}
            >
              <strong style={{ color: !isConnected ? '#fbbf24' : 'var(--text-main)', display: 'block', marginBottom: '0.25rem' }}>
                {!isConnected ? '✓ Active: Mode B (Dataset Fallback)' : 'Mode B: Dataset Fallback'}
              </strong>
              <span>Full operational suite active: inventory, recalls, cold-chain, dispatches, and deterministic query triage.</span>
            </div>
          </div>

          {/* Setup Instructions Section */}
          <div
            style={{
              background: 'var(--bg-card-subtle)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 8,
              padding: '1rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <button
                  onClick={() => setInstructionTab('ollama')}
                  style={{
                    padding: '0.25rem 0.65rem',
                    borderRadius: 4,
                    border: 'none',
                    background: instructionTab === 'ollama' ? 'var(--accent-primary, #6366f1)' : 'var(--bg-surface)',
                    color: instructionTab === 'ollama' ? '#fff' : 'var(--text-muted)',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  1. Ollama Setup
                </button>
                <button
                  onClick={() => setInstructionTab('companion')}
                  style={{
                    padding: '0.25rem 0.65rem',
                    borderRadius: 4,
                    border: 'none',
                    background: instructionTab === 'companion' ? 'var(--accent-primary, #6366f1)' : 'var(--bg-surface)',
                    color: instructionTab === 'companion' ? '#fff' : 'var(--text-muted)',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  2. Local Helper Service
                </button>
                <button
                  onClick={() => setInstructionTab('security')}
                  style={{
                    padding: '0.25rem 0.65rem',
                    borderRadius: 4,
                    border: 'none',
                    background: instructionTab === 'security' ? 'var(--accent-primary, #6366f1)' : 'var(--bg-surface)',
                    color: instructionTab === 'security' ? '#fff' : 'var(--text-muted)',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  3. Browser Security / HTTPS
                </button>
              </div>

              <button
                onClick={() => setShowInstructions((prev) => !prev)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-dim)',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                }}
              >
                {showInstructions ? '▲ Collapse' : '▼ Expand'}
              </button>
            </div>

            {showInstructions && (
              <div>
                {instructionTab === 'ollama' && (
                  <div>
                    {/* OS Selector Tabs */}
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                      {(['linux', 'macos', 'windows'] as const).map((os) => (
                        <button
                          key={os}
                          onClick={() => setSelectedOS(os)}
                          style={{
                            padding: '0.2rem 0.55rem',
                            borderRadius: 4,
                            border: 'none',
                            background: selectedOS === os ? '#475569' : 'transparent',
                            color: selectedOS === os ? '#fff' : 'var(--text-muted)',
                            fontSize: '0.73rem',
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
                        <p style={{ margin: '0 0 0.35rem 0', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                          1. Install Ollama:
                        </p>
                        <div style={{ background: '#0f172a', padding: '0.5rem', borderRadius: 4, fontFamily: 'var(--font-mono)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem', fontSize: '0.78rem' }}>
                          <code>curl -fsSL https://ollama.com/install.sh | sh</code>
                          <button onClick={() => copyToClipboard('curl -fsSL https://ollama.com/install.sh | sh')} style={{ background: 'transparent', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', fontSize: '0.75rem' }}>
                            {copiedCmd === 'curl -fsSL https://ollama.com/install.sh | sh' ? 'Copied!' : 'Copy'}
                          </button>
                        </div>

                        <p style={{ margin: '0 0 0.35rem 0', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                          2. Pull the configured model ({configuredModel}):
                        </p>
                        <div style={{ background: '#0f172a', padding: '0.5rem', borderRadius: 4, fontFamily: 'var(--font-mono)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem', fontSize: '0.78rem' }}>
                          <code>ollama pull {configuredModel}</code>
                          <button onClick={() => copyToClipboard(`ollama pull ${configuredModel}`)} style={{ background: 'transparent', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', fontSize: '0.75rem' }}>
                            {copiedCmd === `ollama pull ${configuredModel}` ? 'Copied!' : 'Copy'}
                          </button>
                        </div>

                        <p style={{ margin: '0 0 0.35rem 0', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                          3. Verify service is active:
                        </p>
                        <div style={{ background: '#0f172a', padding: '0.5rem', borderRadius: 4, fontFamily: 'var(--font-mono)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem' }}>
                          <code>systemctl is-active ollama || ollama serve</code>
                          <button onClick={() => copyToClipboard('systemctl is-active ollama || ollama serve')} style={{ background: 'transparent', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', fontSize: '0.75rem' }}>
                            {copiedCmd === 'systemctl is-active ollama || ollama serve' ? 'Copied!' : 'Copy'}
                          </button>
                        </div>
                      </div>
                    )}

                    {selectedOS === 'macos' && (
                      <div>
                        <p style={{ margin: '0 0 0.35rem 0', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                          1. Install and start via Homebrew or DMG:
                        </p>
                        <div style={{ background: '#0f172a', padding: '0.5rem', borderRadius: 4, fontFamily: 'var(--font-mono)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem', fontSize: '0.78rem' }}>
                          <code>brew install ollama &amp;&amp; brew services start ollama</code>
                          <button onClick={() => copyToClipboard('brew install ollama && brew services start ollama')} style={{ background: 'transparent', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', fontSize: '0.75rem' }}>
                            {copiedCmd === 'brew install ollama && brew services start ollama' ? 'Copied!' : 'Copy'}
                          </button>
                        </div>

                        <p style={{ margin: '0 0 0.35rem 0', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                          2. Pull the configured model:
                        </p>
                        <div style={{ background: '#0f172a', padding: '0.5rem', borderRadius: 4, fontFamily: 'var(--font-mono)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem' }}>
                          <code>ollama pull {configuredModel}</code>
                          <button onClick={() => copyToClipboard(`ollama pull ${configuredModel}`)} style={{ background: 'transparent', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', fontSize: '0.75rem' }}>
                            {copiedCmd === `ollama pull ${configuredModel}` ? 'Copied!' : 'Copy'}
                          </button>
                        </div>
                      </div>
                    )}

                    {selectedOS === 'windows' && (
                      <div>
                        <p style={{ margin: '0 0 0.35rem 0', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                          1. Download and run installer from <code>https://ollama.com/download/windows</code>
                        </p>
                        <p style={{ margin: '0 0 0.35rem 0', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                          2. In PowerShell, pull model:
                        </p>
                        <div style={{ background: '#0f172a', padding: '0.5rem', borderRadius: 4, fontFamily: 'var(--font-mono)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem' }}>
                          <code>ollama pull {configuredModel}</code>
                          <button onClick={() => copyToClipboard(`ollama pull ${configuredModel}`)} style={{ background: 'transparent', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', fontSize: '0.75rem' }}>
                            {copiedCmd === `ollama pull ${configuredModel}` ? 'Copied!' : 'Copy'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {instructionTab === 'companion' && (
                  <div>
                    <p style={{ margin: '0 0 0.5rem 0', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                      The <strong>Arogya Companion</strong> is a lightweight, zero-dependency Python script that bridges your browser to Ollama with origin validation and Private Network Access (PNA) headers:
                    </p>
                    <div style={{ background: '#0f172a', padding: '0.6rem', borderRadius: 4, fontFamily: 'var(--font-mono)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem', fontSize: '0.78rem' }}>
                      <code>python3 scripts/arogya_companion.py</code>
                      <button onClick={() => copyToClipboard('python3 scripts/arogya_companion.py')} style={{ background: 'transparent', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', fontSize: '0.75rem' }}>
                        {copiedCmd === 'python3 scripts/arogya_companion.py' ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                    <ul style={{ margin: 0, paddingLeft: '1.25rem', color: 'var(--text-muted)', fontSize: '0.76rem' }}>
                      <li>Binds strictly to loopback: <code>127.0.0.1:11435</code>.</li>
                      <li>Includes <code>Access-Control-Allow-Private-Network: true</code>.</li>
                      <li>Proxies native Ollama endpoints (<code>/api/tags</code>, <code>/api/chat</code>).</li>
                    </ul>
                  </div>
                )}

                {instructionTab === 'security' && (
                  <div>
                    <p style={{ margin: '0 0 0.5rem 0', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                      <strong>Why can a hosted website be blocked from accessing localhost?</strong>
                    </p>
                    <p style={{ margin: '0 0 0.5rem 0', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                      When accessing Arogya AI over HTTPS (e.g., <code>https://*.vercel.app</code>), browsers enforce <em>Mixed Content</em> and <em>Private Network Access (PNA)</em> restrictions preventing public HTTPS pages from calling unencrypted HTTP loopback services without special preflight authorization.
                    </p>
                    <p style={{ margin: '0 0 0.5rem 0', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                      <strong>Recommended Solution:</strong>
                    </p>
                    <div style={{ background: '#0f172a', padding: '0.5rem', borderRadius: 4, fontFamily: 'var(--font-mono)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', fontSize: '0.76rem' }}>
                      <code>python3 scripts/arogya_companion.py --ssl</code>
                      <button onClick={() => copyToClipboard('python3 scripts/arogya_companion.py --ssl')} style={{ background: 'transparent', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', fontSize: '0.75rem' }}>
                        {copiedCmd === 'python3 scripts/arogya_companion.py --ssl' ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                      Note: You do not need to disable browser security. If local AI is blocked, Arogya AI automatically functions in Dataset Fallback Mode.
                    </span>
                  </div>
                )}
              </div>
            )}
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
                padding: '0.45rem 0.95rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
            >
              <RefreshIcon size={14} className={loading ? 'spin-icon' : ''} />
              <span>{loading ? 'Checking Local AI...' : 'Retry Local AI Connection'}</span>
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
