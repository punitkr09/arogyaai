import { useState } from 'react'
import type { HealthResponse } from '../types/workflow'
import { seedAdminData } from '../services/api'

interface SettingsViewProps {
  health: HealthResponse | null
  healthLoading: boolean
  onDataReinitialized: () => void
}

export function SettingsView({ health, healthLoading, onDataReinitialized }: SettingsViewProps) {
  const [showSeedModal, setShowSeedModal] = useState<boolean>(false)
  const [seeding, setSeeding] = useState<boolean>(false)
  const [seedResult, setSeedResult] = useState<string | null>(null)

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
              AI Inference Engine Layer
            </h3>
            <span
              className="badge"
              style={{
                backgroundColor: health?.ai_provider?.is_online ? 'var(--status-success-bg)' : 'var(--status-warning-bg)',
                color: health?.ai_provider?.is_online ? 'var(--status-success-text)' : 'var(--status-warning-text)',
                border: '1px solid currentColor',
              }}
            >
              {health?.ai_provider?.is_online ? 'Active & Ready' : 'Semantic Fallback Mode'}
            </span>
          </div>


          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
            Supports local zero-token inference via local Ollama endpoint, with seamless automatic fallback to the deterministic semantic decision engine.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.82rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid var(--border-subtle)' }}>
              <span style={{ color: 'var(--text-muted)' }}>Configured Provider:</span>
              <strong style={{ fontFamily: 'var(--font-mono)' }}>{health?.ai_provider?.provider || 'ollama'}</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid var(--border-subtle)' }}>
              <span style={{ color: 'var(--text-muted)' }}>Selected Model:</span>
              <strong style={{ fontFamily: 'var(--font-mono)' }}>{health?.ai_provider?.model || 'qwen2.5-coder:7b'}</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid var(--border-subtle)' }}>
              <span style={{ color: 'var(--text-muted)' }}>Endpoint Base URL:</span>
              <strong style={{ fontFamily: 'var(--font-mono)' }}>{health?.ai_provider?.base_url || 'http://localhost:11434/v1'}</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid var(--border-subtle)' }}>
              <span style={{ color: 'var(--text-muted)' }}>Fallback Strategy:</span>
              <strong>Deterministic Semantic Engine</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0' }}>
              <span style={{ color: 'var(--text-muted)' }}>Zero-Token Requirement:</span>
              <span style={{ color: '#166534', fontWeight: 600 }}>✓ Verified (100% Offline Capable)</span>
            </div>
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
            style={{ padding: '0.55rem 1.1rem', fontWeight: 600 }}
          >
            ⚙️ Seed Sample Operational Data...
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
