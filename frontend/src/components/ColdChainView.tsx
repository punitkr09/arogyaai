import { useEffect, useState } from 'react'
import type { DashboardSummary, TemperatureLog, Warehouse, CreateTemperatureLogInput } from '../types/arogya'
import { fetchTemperatureLogs, createTemperatureLog, fetchWarehouses } from '../services/api'

interface ColdChainViewProps {
  summary: DashboardSummary | null
  onInvestigateExcursions: () => void
}

export function ColdChainView({ summary, onInvestigateExcursions }: ColdChainViewProps) {
  const [telemetryLogs, setTelemetryLogs] = useState<TemperatureLog[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [showLogModal, setShowLogModal] = useState<boolean>(false)
  const [submitting, setSubmitting] = useState<boolean>(false)
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null)

  const [newLogData, setNewLogData] = useState<CreateTemperatureLogInput>({
    warehouse_id: 2,
    cold_room_unit: 'Cold Room Unit 2',
    recorded_temperature_celsius: 12.8,
    permitted_range: '2°C - 8°C',
    duration_minutes: 270,
    thermal_severity: 'Critical',
    notes: 'Compressor refrigerant leak breach confirmed by warehouse technician.',
  })

  const loadLogs = async () => {
    try {
      const logs = await fetchTemperatureLogs()
      setTelemetryLogs(logs)
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    loadLogs()
    fetchWarehouses()
      .then((whs) => {
        setWarehouses(whs)
        const coldWh = whs.find((w) => w.cold_storage_available)
        if (coldWh) setNewLogData((prev) => ({ ...prev, warehouse_id: coldWh.id }))
      })
      .catch(() => {})
  }, [])

  const handleCreateLog = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setFeedbackMsg(null)
    try {
      const created = await createTemperatureLog(newLogData)
      setShowLogModal(false)
      setFeedbackMsg(`✓ Temperature log recorded: ${created.recorded_temperature_celsius}°C in ${created.cold_room_unit} (${created.thermal_severity})`)
      loadLogs()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to record temperature log')
    } finally {
      setSubmitting(false)
    }
  }

  const coldRooms = [
    {
      id: 'CR-01',
      name: 'Depot Central Cold Room (Bhiwandi)',
      sensor_id: 'SENS-CR01-T1',
      temp: '4.2°C',
      target_range: '2.0°C – 8.0°C',
      humidity: '48%',
      status: 'normal',
      stored_batches: ['B2231', 'B2232', 'B1042'],
    },
    {
      id: 'CR-02',
      name: 'North Cold Logistics Hub (NCR)',
      sensor_id: 'SENS-CR02-T4',
      temp: '12.4°C',
      target_range: '2.0°C – 8.0°C',
      humidity: '62%',
      status: 'excursion',
      stored_batches: ['B3011', 'B4022'],
      excursion_details: 'Thermal breach: 12.4°C sustained >72h (+4.4°C above maximum permissible threshold). Compressor cycle failure recorded.',
    },
    {
      id: 'CR-03',
      name: 'West Express Deep Chiller (Pune)',
      sensor_id: 'SENS-CR03-T2',
      temp: '3.8°C',
      target_range: '2.0°C – 8.0°C',
      humidity: '45%',
      status: 'normal',
      stored_batches: ['B9901'],
    },
  ]

  const affectedBatches = [
    {
      batch_number: 'B3011',
      product_name: 'Ceftriaxone 1g IV Injection',
      sku: 'MED-CEF-1G',
      warehouse: 'WH-NORTH (CR-02)',
      quantity: 320,
      storage_spec: '2°C to 8°C (Cold Chain)',
      status: 'dispatch_hold',
      containment_status: 'Automated Quarantine Lock Pending Pharmacist Release',
    },
    {
      batch_number: 'B4022',
      product_name: 'Meropenem 1g IV Infusion',
      sku: 'MED-MER-1G',
      warehouse: 'WH-NORTH (CR-02)',
      quantity: 180,
      storage_spec: '2°C to 8°C (Cold Chain)',
      status: 'dispatch_hold',
      containment_status: 'Stability Testing Sample Dispatched to Quality Control',
    },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Top Banner */}
      <div className="agent-control-panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.25rem' }}>
              Cold-Chain Telemetry & Stability Excursion Monitor
            </h2>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Continuous IoT thermal monitoring for biologicals, injectables, and thermo-labile pharmaceutical products. Automated breach containment.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              className="btn-secondary"
              onClick={() => setShowLogModal(true)}
              style={{ fontSize: '0.82rem', padding: '0.4rem 0.85rem' }}
            >
              + Log Temperature Check / Breach
            </button>
            <button className="btn-primary" onClick={onInvestigateExcursions} style={{ fontSize: '0.82rem', padding: '0.4rem 0.95rem' }}>
              ⚡ Run Autonomous Cold-Chain Investigation &rarr;
            </button>
          </div>
        </div>
      </div>

      {feedbackMsg && (
        <div
          style={{
            padding: '0.75rem 1rem',
            backgroundColor: 'var(--status-success-bg)',
            color: 'var(--status-success-text)',
            borderRadius: 6,
            border: '1px solid var(--status-success-border)',
            fontSize: '0.82rem',
            fontWeight: 600,
          }}
        >
          {feedbackMsg}
        </div>
      )}

      {/* Metrics Grid */}
      <div className="metrics-grid">
        <div className="metric-card">
          <span className="metric-label">Monitored Facilities</span>
          <span className="metric-value">3</span>
          <span className="metric-sub">Active cold storage zones</span>
        </div>

        <div className="metric-card alert-card">
          <span className="metric-label">Active Excursions</span>
          <span className="metric-value" style={{ color: 'var(--accent-terracotta)' }}>
            {summary?.cold_chain_exceptions ?? 1}
          </span>
          <span className="metric-sub">CR-02 North Logistics breach</span>
        </div>

        <div className="metric-card">
          <span className="metric-label">Affected Batches</span>
          <span className="metric-value">2</span>
          <span className="metric-sub">500 total thermo-labile units</span>
        </div>

        <div className="metric-card">
          <span className="metric-label">Containment Protocol</span>
          <span className="metric-value" style={{ fontSize: '1.25rem', color: '#166534' }}>
            ACTIVE
          </span>
          <span className="metric-sub">Dispatch holds automatically enforced</span>
        </div>
      </div>

      {/* Facility Sensor Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
        {coldRooms.map((cr) => (
          <div
            key={cr.id}
            style={{
              background: 'var(--bg-surface)',
              borderRadius: 8,
              border: cr.status === 'excursion' ? '2px solid var(--accent-terracotta)' : '1px solid var(--border-subtle)',
              padding: '1.25rem',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
              <div>
                <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-muted)' }}>
                  {cr.sensor_id}
                </span>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-main)' }}>{cr.name}</h3>
              </div>

              <span
                style={{
                  padding: '0.2rem 0.55rem',
                  borderRadius: 4,
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  backgroundColor: cr.status === 'excursion' ? 'var(--status-critical-bg)' : 'var(--status-success-bg)',
                  color: cr.status === 'excursion' ? 'var(--status-critical-text)' : 'var(--status-success-text)',
                  border: '1px solid currentColor',
                }}
              >
                {cr.status === 'excursion' ? '⚠️ EXCURSION BREACH' : '✓ NORMAL 2-8°C'}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', marginBottom: '0.5rem' }}>
              <span
                style={{
                  fontSize: '2rem',
                  fontWeight: 700,
                  color: cr.status === 'excursion' ? 'var(--accent-terracotta)' : 'var(--text-main)',
                }}
              >
                {cr.temp}
              </span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Target: {cr.target_range} (RH {cr.humidity})
              </span>
            </div>

            {cr.excursion_details && (
              <div
                style={{
                  padding: '0.65rem 0.85rem',
                  backgroundColor: 'var(--accent-terracotta-light)',
                  border: '1px solid var(--accent-terracotta-border)',
                  borderRadius: 6,
                  fontSize: '0.78rem',
                  color: 'var(--accent-terracotta-dark)',
                  marginBottom: '0.75rem',
                  lineHeight: 1.4,
                }}
              >
                <strong>Critical Finding:</strong> {cr.excursion_details}
              </div>
            )}

            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              <strong>Stored Batches in Zone:</strong>{' '}
              {cr.stored_batches.map((b) => (
                <span
                  key={b}
                  style={{
                    fontFamily: 'var(--font-mono)',
                    backgroundColor: 'var(--bg-tag)',
                    padding: '0.1rem 0.35rem',
                    borderRadius: 4,
                    marginRight: '0.35rem',
                    fontSize: '0.75rem',
                  }}
                >
                  {b}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Affected Batches Table */}
      <div className="table-container">
        <div className="table-toolbar">
          <div>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-main)' }}>
              At-Risk Thermo-Labile Batches Under Stability Review
            </h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Batches automatically placed on dispatch hold pending Qualified Person stability assessment
            </p>
          </div>
          <span className="badge badge-online">Safety Barrier Enforced</span>
        </div>

        <table className="data-table">
          <thead>
            <tr>
              <th>Batch Number</th>
              <th>Product Name</th>
              <th>Location</th>
              <th>Units Impacted</th>
              <th>Required Storage</th>
              <th>Status</th>
              <th>Containment Status</th>
            </tr>
          </thead>
          <tbody>
            {affectedBatches.map((b) => (
              <tr key={b.batch_number}>
                <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{b.batch_number}</td>
                <td>
                  <div style={{ fontWeight: 600 }}>{b.product_name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>SKU: {b.sku}</div>
                </td>
                <td>{b.warehouse}</td>
                <td style={{ fontWeight: 700 }}>{b.quantity}</td>
                <td>{b.storage_spec}</td>
                <td>
                  <span
                    style={{
                      padding: '0.15rem 0.45rem',
                      borderRadius: 4,
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      backgroundColor: 'var(--status-warning-bg)',
                      color: 'var(--status-warning-text)',
                      border: '1px solid currentColor',
                    }}
                  >
                    DISPATCH HOLD
                  </span>
                </td>
                <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{b.containment_status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Dynamic Telemetry Sensor Event Ledger */}
      {telemetryLogs.length > 0 && (
        <div className="table-container">
          <div className="table-toolbar">
            <div>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-main)' }}>
                Recorded Sensor Readings & Excursion Logs ({telemetryLogs.length} entries)
              </h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Audit trail of automated and manual temperature checks across facilities
              </p>
            </div>
            <span className="badge badge-online">Live IoT Data</span>
          </div>

          <table className="data-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Facility & Zone</th>
                <th>Recorded Temp</th>
                <th>Permitted Range</th>
                <th>Duration</th>
                <th>Severity</th>
                <th>Notes / Findings</th>
              </tr>
            </thead>
            <tbody>
              {telemetryLogs.map((log) => (
                <tr key={log.id}>
                  <td>{new Date(log.recorded_at).toLocaleString()}</td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{log.cold_room_unit}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{log.warehouse_name}</div>
                  </td>
                  <td>
                    <strong style={{ fontSize: '1rem', color: log.recorded_temperature_celsius > 8 ? '#b91c1c' : '#15803d' }}>
                      {log.recorded_temperature_celsius}°C
                    </strong>
                  </td>
                  <td>{log.permitted_range}</td>
                  <td>{log.duration_minutes > 0 ? `${log.duration_minutes} min` : 'Point Check'}</td>
                  <td>
                    <span
                      style={{
                        padding: '0.15rem 0.45rem',
                        borderRadius: 4,
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        backgroundColor: log.thermal_severity === 'Critical' ? 'var(--status-critical-bg)' : 'var(--status-success-bg)',
                        color: log.thermal_severity === 'Critical' ? 'var(--status-critical-text)' : 'var(--status-success-text)',
                        border: '1px solid currentColor',
                      }}
                    >
                      {log.thermal_severity.toUpperCase()}
                    </span>
                  </td>
                  <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{log.notes || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Log Temperature Modal */}
      {showLogModal && (
        <div className="modal-overlay" onClick={() => setShowLogModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 500 }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '0.35rem', color: 'var(--text-main)' }}>
              Log Facility Temperature Check / Excursion
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              Record calibrated sensor telemetry or manual thermal inspection report.
            </p>

            <form onSubmit={handleCreateLog} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>
                    Facility *
                  </label>
                  <select
                    className="select-filter"
                    style={{ width: '100%' }}
                    value={newLogData.warehouse_id}
                    onChange={(e) => setNewLogData({ ...newLogData, warehouse_id: Number(e.target.value) })}
                  >
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({w.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>
                    Cold Storage Unit *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Cold Room Unit 2"
                    className="search-input"
                    style={{ width: '100%' }}
                    value={newLogData.cold_room_unit}
                    onChange={(e) => setNewLogData({ ...newLogData, cold_room_unit: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>
                    Recorded Temp (°C) *
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    className="search-input"
                    style={{ width: '100%' }}
                    value={newLogData.recorded_temperature_celsius}
                    onChange={(e) => {
                      const t = Number(e.target.value)
                      setNewLogData({
                        ...newLogData,
                        recorded_temperature_celsius: t,
                        thermal_severity: t > 8 || t < 2 ? 'Critical' : 'Normal',
                      })
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>
                    Permitted Limit Range
                  </label>
                  <input
                    type="text"
                    className="search-input"
                    style={{ width: '100%' }}
                    value={newLogData.permitted_range || '2°C - 8°C'}
                    onChange={(e) => setNewLogData({ ...newLogData, permitted_range: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>
                    Excursion Duration (Min)
                  </label>
                  <input
                    type="number"
                    min={0}
                    className="search-input"
                    style={{ width: '100%' }}
                    value={newLogData.duration_minutes || 0}
                    onChange={(e) => setNewLogData({ ...newLogData, duration_minutes: Number(e.target.value) })}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>
                    Severity
                  </label>
                  <select
                    className="select-filter"
                    style={{ width: '100%' }}
                    value={newLogData.thermal_severity}
                    onChange={(e) => setNewLogData({ ...newLogData, thermal_severity: e.target.value })}
                  >
                    <option value="Normal">Normal (Compliant)</option>
                    <option value="Warning">Warning (Approaching Limit)</option>
                    <option value="Critical">Critical (Thermal Excursion)</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>
                  Technician Observations / Findings
                </label>
                <textarea
                  className="prompt-textarea"
                  style={{ minHeight: 65 }}
                  value={newLogData.notes || ''}
                  onChange={(e) => setNewLogData({ ...newLogData, notes: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowLogModal(false)}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={submitting}>
                  {submitting ? 'Recording...' : 'Record Telemetry Entry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
