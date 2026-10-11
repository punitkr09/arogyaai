import { useState } from 'react'
import type { HealthResponse } from '../types/workflow'
import { seedAdminData } from '../services/api'
import { localAiService } from '../services/localAiService'
import { AgentIcon, SettingsIcon, SunIcon, MoonIcon } from './Icons'

interface SettingsViewProps {
  health: HealthResponse | null
  healthLoading: boolean
  theme?: 'dark' | 'light'
  onSetTheme?: (theme: 'dark' | 'light') => void
  onDataReinitialized: () => void
  onOpenOfflineModelModal?: () => void
}

export function SettingsView({
  health,
  healthLoading,
  theme = 'dark',
  onSetTheme,
  onDataReinitialized,
  onOpenOfflineModelModal,
}: SettingsViewProps) {
  const [showSeedModal, setShowSeedModal] = useState<boolean>(false)
  const [seeding, setSeeding] = useState<boolean>(false)
  const [seedResult, setSeedResult] = useState<string | null>(null)

  const [ollamaEndpoint, setOllamaEndpoint] = useState<string>(() => localAiService.getConfig().ollamaUrl)
  const [helperEndpoint, setHelperEndpoint] = useState<string>(() => localAiService.getConfig().helperUrl)
  const [selectedModel, setSelectedModel] = useState<string>(() => localAiService.getConfig().modelName)
  const [testingAi, setTestingAi] = useState<boolean>(false)
  const [aiTestResult, setAiTestResult] = useState<string | null>(null)

  const handleSaveAndTestAi = async () => {
    setTestingAi(true)
    setAiTestResult(null)
    try {
      localAiService.saveConfig({
        ollamaUrl: ollamaEndpoint.trim(),
        helperUrl: helperEndpoint.trim(),
        modelName: selectedModel.trim(),
      })
      const status = await localAiService.checkConnection(true)
      if (status.state === 'local_ai_connected') {
        setAiTestResult(`✓ Connected! Model '${status.model}' verified (${status.latencyMs}ms).`)
      } else if (status.state === 'model_missing') {
        setAiTestResult(`⚠ Ollama is running, but model '${status.model}' is missing. Installed: [${status.availableModels.join(', ')}]`)
      } else {
        setAiTestResult(`✕ ${status.stateLabel}: ${status.message}`)
      }
    } catch (err: unknown) {
      setAiTestResult(`✕ Error: ${(err as Error)?.message || 'Failed to connect'}`)
    } finally {
      setTestingAi(false)
    }
  }

  const handleSeed = async () => {
    setSeeding(true)
    setSeedResult(null)
    try {
      const res = await seedAdminData()
      setSeedResult(`✓ ${res.message}`)
      setShowSeedModal(false)
      onDataReinitialized()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Seeding failed')
    } finally {
      setSeeding(false)
    }
  }

  const localAiStatus = localAiService.getStatus()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Banner */}
      <div className="agent-control-panel">
        <div>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.25rem' }}>
            System Architecture, AI Provider & Governance Settings
          </h2>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            Real-time status of local AI inference engines, database connections, pharmaceutical safety invariants, and administrative data management.
          </p>
        </div>
      </div>

      {seedResult && (
        <div
          style={{
            padding: '0.85rem 1rem',
            backgroundColor: 'var(--status-success-bg)',
            color: 'var(--status-success-text)',
            borderRadius: 6,
            border: '1px solid var(--status-success-border)',
            fontSize: '0.85rem',
            fontWeight: 600,
          }}
        >
          {seedResult}
        </div>
      )}

      {/* Grid: AI Provider + Database */}
      <div className="workspace-grid">
        {/* Left: AI Inference Provider */}
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '1.25rem', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-main)' }}>
              Local AI Inference Layer
            </h3>
            <span
              className="badge"
              style={{
                backgroundColor: localAiStatus.state === 'local_ai_connected' ? 'var(--status-success-bg)' : 'var(--status-warning-bg)',
                color: localAiStatus.state === 'local_ai_connected' ? 'var(--status-success-text)' : 'var(--status-warning-text)',
                border: '1px solid currentColor',
              }}
            >
              {localAiStatus.state === 'local_ai_connected' ? 'Mode A: Local AI Active' : 'Mode B: Dataset Fallback Active'}
            </span>
          </div>

          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
            Inference executes 100% locally on your machine via Ollama. When offline or blocked by browser security, Arogya AI automatically operates in Dataset Fallback Mode.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.82rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                Local Ollama Endpoint URL:
              </label>
              <input
                type="text"
                value={ollamaEndpoint}
                onChange={(e) => setOllamaEndpoint(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.4rem 0.6rem',
                  fontSize: '0.8rem',
                  fontFamily: 'var(--font-mono)',
                  borderRadius: 4,
                  border: '1px solid var(--border-medium)',
                  background: 'var(--bg-card-subtle)',
                  color: 'var(--text-main)',
                }}
                placeholder="http://127.0.0.1:11434"
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                Local Companion Helper URL (for HTTPS web apps):
              </label>
              <input
                type="text"
                value={helperEndpoint}
                onChange={(e) => setHelperEndpoint(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.4rem 0.6rem',
                  fontSize: '0.8rem',
                  fontFamily: 'var(--font-mono)',
                  borderRadius: 4,
                  border: '1px solid var(--border-medium)',
                  background: 'var(--bg-card-subtle)',
                  color: 'var(--text-main)',
                }}
                placeholder="http://127.0.0.1:11435"
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                Configured Model Name:
              </label>
              <input
                type="text"
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.4rem 0.6rem',
                  fontSize: '0.8rem',
                  fontFamily: 'var(--font-mono)',
                  borderRadius: 4,
                  border: '1px solid var(--border-medium)',
                  background: 'var(--bg-card-subtle)',
                  color: 'var(--text-main)',
                }}
                placeholder="qwen2.5-coder:7b"
              />
            </div>

            <button
              onClick={handleSaveAndTestAi}
              disabled={testingAi}
              className="btn-primary"
              style={{
                marginTop: '0.35rem',
                fontSize: '0.8rem',
                padding: '0.45rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.4rem',
              }}
            >
              {testingAi ? 'Testing Connection...' : 'Save & Test Local AI Connection'}
            </button>

            {aiTestResult && (
              <div
                style={{
                  padding: '0.6rem',
                  borderRadius: 4,
                  backgroundColor: aiTestResult.startsWith('✓') ? 'var(--status-success-bg)' : 'var(--bg-card-subtle)',
                  color: aiTestResult.startsWith('✓') ? 'var(--status-success-text)' : 'var(--text-main)',
                  border: `1px solid ${aiTestResult.startsWith('✓') ? 'var(--status-success-border)' : 'var(--border-subtle)'}`,
                  fontSize: '0.76rem',
                  lineHeight: 1.4,
                }}
              >
                {aiTestResult}
              </div>
            )}

            {onOpenOfflineModelModal && (
              <button
                className="btn-secondary"
                onClick={onOpenOfflineModelModal}
                style={{
                  fontSize: '0.8rem',
                  padding: '0.45rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.4rem',
                }}
              >
                <AgentIcon size={16} /> Ollama Setup &amp; Troubleshooting Guide...
              </button>
            )}
          </div>
        </div>

        {/* Right: Database & Safety Invariants */}
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '1.25rem', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-main)' }}>
              Persistence & Safety Invariants
            </h3>
            <span className="badge badge-online">
              {healthLoading ? 'Connecting...' : health?.database_status === 'connected' ? 'SQLite Online' : 'Active'}
            </span>
          </div>

          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
            Hardcoded pharmaceutical distribution compliance rules enforced at the API and service layers.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            <div className="check-item">
              <span className="check-icon-pass">✓</span>
              <div className="check-content">
                <h4>Dispatch Freeze Barrier (HTTP 403)</h4>
                <p>Batches with status &lsquo;recalled&rsquo;, &lsquo;quarantine&rsquo;, or &lsquo;dispatch_hold&rsquo; are rejected at the API gateway.</p>
              </div>
            </div>

            <div className="check-item">
              <span className="check-icon-pass">✓</span>
              <div className="check-content">
                <h4>Qualified Person (QP) Approval Gate</h4>
                <p>All consequential mutations (quarantine holds, supplier POs, supplier returns) require authorized role sign-off.</p>
              </div>
            </div>

            <div className="check-item">
              <span className="check-icon-pass">✓</span>
              <div className="check-content">
                <h4>Independent Invariant Verification</h4>
                <p>Quantities, coverage, and recipient numbers are re-calculated directly against database tables before proposal staging.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Interface Theme & Appearance Preference */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '1.25rem', boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.25rem' }}>
              Interface Theme & Appearance Preference
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Choose your preferred visual presentation: High-contrast Dark Mode (deep obsidian palette for mission-critical telemetry) or Clean Light Mode (clinical paper canvas).
            </p>
          </div>

          <div style={{ display: 'inline-flex', padding: 4, background: 'var(--bg-card-subtle)', borderRadius: 8, border: '1px solid var(--border-subtle)', gap: 4 }}>
            <button
              onClick={() => onSetTheme?.('dark')}
              className={theme === 'dark' ? 'btn-primary' : 'btn-secondary'}
              style={{
                fontSize: '0.78rem',
                padding: '0.35rem 0.85rem',
                borderRadius: 6,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                cursor: 'pointer',
              }}
              title="Set Dark Mode"
            >
              <MoonIcon size={14} /> Dark Mode
            </button>
            <button
              onClick={() => onSetTheme?.('light')}
              className={theme === 'light' ? 'btn-primary' : 'btn-secondary'}
              style={{
                fontSize: '0.78rem',
                padding: '0.35rem 0.85rem',
                borderRadius: 6,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                cursor: 'pointer',
              }}
              title="Set Light Mode"
            >
              <SunIcon size={14} /> Light Mode
            </button>
          </div>
        </div>
      </div>

      {/* Administrative Data Management */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '1.25rem', boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.25rem' }}>
              Sample Operational Data Initialization
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Populate the relational database with benchmark pharmaceutical batches (B2231 recall, B2232 replacement, B1042 expiry, B3011 thermal excursion), facility sensor feeds, and outward consignments.
            </p>
          </div>

          <button
            className="btn-secondary"
            onClick={() => setShowSeedModal(true)}
            style={{ padding: '0.55rem 1.1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <SettingsIcon size={14} /> Seed Sample Operational Data...
          </button>
        </div>
      </div>

      {/* Seed Confirmation Modal */}
      {showSeedModal && (
        <div className="modal-overlay" onClick={() => setShowSeedModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 500 }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '0.35rem', color: 'var(--text-main)' }}>
              Initialize Sample Operational Data?
            </h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.45, marginBottom: '1.25rem' }}>
              This administrative action will re-seed the SQLite database with benchmark pharmaceutical records:
              <br /><br />
              &bull; <strong>4 Products:</strong> Amoxicillin 500mg, Ceftriaxone 1g, Meropenem 1g, Metformin 500mg.<br />
              &bull; <strong>6 Batches:</strong> B2231 (Recalled), B2232 (Replacement), B1042 (Expiring in 42d), B3011 (Cold Excursion), B4022 (Meropenem), B9901 (Metformin).<br />
              &bull; <strong>25+ Customer Consignments:</strong> Hospitals (Apex Heart, Lilavati, Fortis) and retail chemists.<br />
              &bull; <strong>Sensors &ms; MSAs:</strong> Real storage zones, temperature logs, and supplier contracts.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button className="btn-secondary" onClick={() => setShowSeedModal(false)} disabled={seeding}>
                Cancel
              </button>
              <button className="btn-primary" onClick={handleSeed} disabled={seeding}>
                {seeding ? 'Initializing...' : 'Confirm & Seed Database'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
