import { useState } from 'react'

interface ExpiryReturnsViewProps {
  onInvestigateReturns: () => void
}

interface ReturnItem {
  batch_number: string
  product_name: string
  sku: string
  supplier: string
  quantity: number
  expiry_date: string
  days_to_expiry: number
  return_policy_window_days: number
  days_remaining_in_window: number
  unit_cost: number
  total_salvage_credit: number
  status: string
  risk_level: string
  recommendation: string
}

export function ExpiryReturnsView({ onInvestigateReturns }: ExpiryReturnsViewProps) {
  const [expiryBatches, setExpiryBatches] = useState<ReturnItem[]>([
    {
      batch_number: 'B1042',
      product_name: 'Ceftriaxone 1g IV Injection',
      sku: 'MED-CEF-1G',
      supplier: 'Sun Pharma Laboratories Ltd',
      quantity: 150,
      expiry_date: '2026-05-15',
      days_to_expiry: 42,
      return_policy_window_days: 45,
      days_remaining_in_window: 6,
      unit_cost: 180,
      total_salvage_credit: 27000,
      status: 'eligible',
      risk_level: 'critical',
      recommendation: 'Initiate RTV (Return to Vendor) immediately. 6 days before credit eligibility expires.',
    },
    {
      batch_number: 'B9901',
      product_name: 'Metformin 500mg SR Tablets',
      sku: 'MED-MET-500',
      supplier: 'Cipla Ltd',
      quantity: 600,
      expiry_date: '2026-06-25',
      days_to_expiry: 83,
      return_policy_window_days: 60,
      days_remaining_in_window: 23,
      unit_cost: 15,
      total_salvage_credit: 9000,
      status: 'eligible',
      risk_level: 'warning',
      recommendation: 'FEFO Outward Allocation recommended. Fast-moving item with 23 days return window buffer.',
    },
    {
      batch_number: 'B2232',
      product_name: 'Amoxicillin 500mg Capsules',
      sku: 'MED-AMX-500',
      supplier: 'Cipla Ltd',
      quantity: 450,
      expiry_date: '2027-02-15',
      days_to_expiry: 318,
      return_policy_window_days: 60,
      days_remaining_in_window: 258,
      unit_cost: 45,
      total_salvage_credit: 20250,
      status: 'stable',
      risk_level: 'low',
      recommendation: 'Optimal stock. Serves as replacement inventory for recalled batch B2231.',
    },
  ])

  // Add RMA Return Modal state
  const [showRMAModal, setShowRMAModal] = useState<boolean>(false)
  const [newRMA, setNewRMA] = useState({
    batch_number: '',
    product_name: '',
    sku: '',
    supplier: 'Sun Pharma Laboratories Ltd',
    quantity: 100,
    unit_cost: 120,
    return_policy_window_days: 60,
    recommendation: 'Scheduled supplier return before policy deadline.',
  })

  // Edit Item Modal state
  const [editingItem, setEditingItem] = useState<ReturnItem | null>(null)
  const [editPolicyDays, setEditPolicyDays] = useState<number>(45)
  const [editRecommendation, setEditRecommendation] = useState<string>('')

  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null)

  const handleCreateRMA = (e: React.FormEvent) => {
    e.preventDefault()
    const item: ReturnItem = {
      batch_number: newRMA.batch_number.toUpperCase(),
      product_name: newRMA.product_name,
      sku: newRMA.sku.toUpperCase(),
      supplier: newRMA.supplier,
      quantity: newRMA.quantity,
      expiry_date: '2026-06-30',
      days_to_expiry: 60,
      return_policy_window_days: newRMA.return_policy_window_days,
      days_remaining_in_window: Math.max(0, newRMA.return_policy_window_days - 20),
      unit_cost: newRMA.unit_cost,
      total_salvage_credit: newRMA.quantity * newRMA.unit_cost,
      status: 'pending_rtv',
      risk_level: 'warning',
      recommendation: newRMA.recommendation,
    }
    setExpiryBatches([item, ...expiryBatches])
    setShowRMAModal(false)
    setFeedbackMsg(`✓ RMA return record registered for Batch ${item.batch_number} (₹${item.total_salvage_credit.toLocaleString()} credit)!`)
  }

  const handleOpenEdit = (item: ReturnItem) => {
    setEditingItem(item)
    setEditPolicyDays(item.return_policy_window_days)
    setEditRecommendation(item.recommendation)
  }

  const handleOpenRMAForBatch = (b: ReturnItem) => {
    setNewRMA({
      batch_number: b.batch_number,
      product_name: b.product_name,
      sku: b.sku,
      supplier: b.supplier,
      quantity: b.quantity,
      unit_cost: b.unit_cost,
      return_policy_window_days: b.return_policy_window_days,
      recommendation: b.recommendation,
    })
    setShowRMAModal(true)
  }

  const handleHoldBatch = (b: ReturnItem) => {
    setFeedbackMsg(`✓ Batch ${b.batch_number} placed on immediate Dispatch Freeze. Quarantine order recorded in ledger.`)
  }

  const handleUpdateItem = (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingItem) return
    setExpiryBatches(
      expiryBatches.map((b) =>
        b.batch_number === editingItem.batch_number
          ? {
              ...b,
              return_policy_window_days: editPolicyDays,
              recommendation: editRecommendation,
            }
          : b
      )
    )
    setEditingItem(null)
    setFeedbackMsg(`✓ Return policy parameters updated for Batch ${editingItem.batch_number}!`)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Banner */}
      <div className="agent-control-panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.25rem' }}>
              FEFO Expiry Auditing & Supplier Return Optimization
            </h2>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              First-Expired, First-Out compliance engine: prevent obsolescence write-offs by actively tracking contractual supplier return windows.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              className="btn-secondary"
              onClick={() => setShowRMAModal(true)}
              style={{ fontSize: '0.82rem', padding: '0.4rem 0.85rem' }}
            >
              + Record Vendor Return (RMA)
            </button>
            <button className="btn-primary" onClick={onInvestigateReturns} style={{ fontSize: '0.82rem', padding: '0.4rem 0.95rem' }}>
              ⚡ Run Autonomous Expiry & Return Audit &rarr;
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
        <div className="metric-card alert-card">
          <span className="metric-label">Immediate Return Windows</span>
          <span className="metric-value" style={{ color: 'var(--accent-terracotta)' }}>
            1
          </span>
          <span className="metric-sub">B1042 window closes in 6 days</span>
        </div>

        <div className="metric-card">
          <span className="metric-label">Salvageable Credit Value</span>
          <span className="metric-value">₹36,000</span>
          <span className="metric-sub">Recoverable supplier credit</span>
        </div>

        <div className="metric-card">
          <span className="metric-label">Expiring in 90 Days</span>
          <span className="metric-value">2</span>
          <span className="metric-sub">750 total units in critical/warning horizon</span>
        </div>

        <div className="metric-card">
          <span className="metric-label">FEFO Compliance</span>
          <span className="metric-value" style={{ fontSize: '1.3rem', color: '#166534' }}>
            OPTIMAL
          </span>
          <span className="metric-sub">Automated dispatch prioritization active</span>
        </div>
      </div>

      {/* Supplier Return Eligibility Table */}
      <div className="table-container">
        <div className="table-toolbar">
          <div>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-main)' }}>
              Contractual Return Windows & Credit Salvage Ledger
            </h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Audited against supplier Master Services Agreements (MSAs)
            </p>
          </div>
          <span className="badge badge-online">Financial Risk Mitigated</span>
        </div>

        <table className="data-table">
          <thead>
            <tr>
              <th>Batch Number</th>
              <th>Product & Supplier</th>
              <th>Available Qty</th>
              <th>Expiry Horizon</th>
              <th>Return Policy Window</th>
              <th>Window Closes In</th>
              <th>Potential Credit</th>
              <th>Recommended Action</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {expiryBatches.map((b) => (
              <tr key={b.batch_number}>
                <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{b.batch_number}</td>
                <td>
                  <div style={{ fontWeight: 600 }}>{b.product_name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{b.supplier}</div>
                </td>
                <td style={{ fontWeight: 700 }}>{b.quantity}</td>
                <td>
                  <div>{b.expiry_date}</div>
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      color: b.risk_level === 'critical' ? '#b91c1c' : b.risk_level === 'warning' ? '#b45309' : '#15803d',
                    }}
                  >
                    {b.days_to_expiry} days remaining
                  </span>
                </td>
                <td>
                  <span style={{ fontSize: '0.8rem' }}>{b.return_policy_window_days} days pre-expiry</span>
                </td>
                <td>
                  <span
                    style={{
                      padding: '0.15rem 0.45rem',
                      borderRadius: 4,
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      backgroundColor:
                        b.days_remaining_in_window <= 7
                          ? 'var(--status-critical-bg)'
                          : b.days_remaining_in_window <= 30
                          ? 'var(--status-warning-bg)'
                          : 'var(--status-success-bg)',
                      color:
                        b.days_remaining_in_window <= 7
                          ? 'var(--status-critical-text)'
                          : b.days_remaining_in_window <= 30
                          ? 'var(--status-warning-text)'
                          : 'var(--status-success-text)',
                      border: '1px solid currentColor',
                    }}
                  >
                    {b.days_remaining_in_window <= 7
                      ? `⚠️ ${b.days_remaining_in_window} DAYS LEFT`
                      : `${b.days_remaining_in_window} days buffer`}
                  </span>
                </td>
                <td style={{ fontWeight: 700, color: 'var(--accent-terracotta)' }}>
                  ₹{b.total_salvage_credit.toLocaleString()}
                </td>
                <td style={{ fontSize: '0.78rem', color: 'var(--text-main)', maxWidth: 260 }}>
                  {b.recommendation}
                </td>
                <td>
                  <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'nowrap' }}>
                    <button
                      className="btn-primary"
                      onClick={() => handleOpenRMAForBatch(b)}
                      style={{ padding: '0.2rem 0.55rem', fontSize: '0.72rem', whiteSpace: 'nowrap' }}
                      title="Initiate Vendor Return Authorization (RMA)"
                    >
                      Initiate RMA &rarr;
                    </button>
                    <button
                      className="btn-secondary"
                      onClick={() => handleOpenEdit(b)}
                      style={{ padding: '0.2rem 0.45rem', fontSize: '0.72rem' }}
                      title="Edit Policy Parameters"
                    >
                      ✎ Edit
                    </button>
                    <button
                      className="btn-secondary"
                      onClick={() => handleHoldBatch(b)}
                      style={{ padding: '0.2rem 0.45rem', fontSize: '0.72rem', color: 'var(--accent-primary)' }}
                      title="Place batch on dispatch freeze"
                    >
                      ❄️ Hold
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Record RMA Modal */}
      {showRMAModal && (
        <div className="modal-overlay" onClick={() => setShowRMAModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 500 }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '0.35rem', color: 'var(--text-main)' }}>
              Record Vendor Return Authorization (RMA)
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              Document pending stock return for contractual credit salvage.
            </p>

            <form onSubmit={handleCreateRMA} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>
                    Batch Number *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. B8810"
                    className="search-input"
                    style={{ width: '100%', fontFamily: 'var(--font-mono)' }}
                    value={newRMA.batch_number}
                    onChange={(e) => setNewRMA({ ...newRMA, batch_number: e.target.value })}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>
                    Product SKU *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. MED-CEF-1G"
                    className="search-input"
                    style={{ width: '100%' }}
                    value={newRMA.sku}
                    onChange={(e) => setNewRMA({ ...newRMA, sku: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>
                  Product Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ceftriaxone 1g IV Injection"
                  className="search-input"
                  style={{ width: '100%' }}
                  value={newRMA.product_name}
                  onChange={(e) => setNewRMA({ ...newRMA, product_name: e.target.value })}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>
                    Units to Return *
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    className="search-input"
                    style={{ width: '100%' }}
                    value={newRMA.quantity}
                    onChange={(e) => setNewRMA({ ...newRMA, quantity: Number(e.target.value) })}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>
                    Unit Credit Value (₹) *
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    className="search-input"
                    style={{ width: '100%' }}
                    value={newRMA.unit_cost}
                    onChange={(e) => setNewRMA({ ...newRMA, unit_cost: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>
                  Supplier / Manufacturer
                </label>
                <select
                  className="select-filter"
                  style={{ width: '100%' }}
                  value={newRMA.supplier}
                  onChange={(e) => setNewRMA({ ...newRMA, supplier: e.target.value })}
                >
                  <option value="Sun Pharma Laboratories Ltd">Sun Pharma Laboratories Ltd</option>
                  <option value="Cipla Ltd">Cipla Ltd</option>
                  <option value="Biocon Biologics">Biocon Biologics</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>
                  Return Action Justification
                </label>
                <textarea
                  className="prompt-textarea"
                  style={{ minHeight: 60 }}
                  value={newRMA.recommendation}
                  onChange={(e) => setNewRMA({ ...newRMA, recommendation: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowRMAModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Save RMA Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Return Policy Modal */}
      {editingItem && (
        <div className="modal-overlay" onClick={() => setEditingItem(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '0.35rem', color: 'var(--text-main)' }}>
              Edit Return Policy: {editingItem.batch_number}
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              Adjust contractual return eligibility threshold or action recommendation.
            </p>

            <form onSubmit={handleUpdateItem} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>
                  Contractual Return Window (Days Pre-Expiry)
                </label>
                <input
                  type="number"
                  min={10}
                  max={120}
                  required
                  className="search-input"
                  style={{ width: '100%' }}
                  value={editPolicyDays}
                  onChange={(e) => setEditPolicyDays(Number(e.target.value))}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>
                  Operational Recommendation / Strategy
                </label>
                <textarea
                  required
                  className="prompt-textarea"
                  style={{ minHeight: 75 }}
                  value={editRecommendation}
                  onChange={(e) => setEditRecommendation(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setEditingItem(null)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Save Updates
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
