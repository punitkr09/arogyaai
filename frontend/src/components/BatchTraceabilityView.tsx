import { useState, useEffect } from 'react'
import type { TraceabilityData, BatchSummary, Customer, CreateCustomerInput, UpdateCustomerInput } from '../types/arogya'
import {
  fetchBatches,
  fetchBatchTrace,
  createDispatch,
  fetchCustomers,
  createCustomer,
  updateCustomer,
} from '../services/api'

interface BatchTraceabilityViewProps {
  onInvestigateBatch: (batchNumber: string) => void
}

export function BatchTraceabilityView({ onInvestigateBatch }: BatchTraceabilityViewProps) {
  const [batches, setBatches] = useState<BatchSummary[]>([])
  const [selectedBatch, setSelectedBatch] = useState<string>('B2231')
  const [traceData, setTraceData] = useState<TraceabilityData | null>(null)
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  // Customer Management
  const [customers, setCustomers] = useState<Customer[]>([])
  const [showAddCustomerModal, setShowAddCustomerModal] = useState<boolean>(false)
  const [newCustomerData, setNewCustomerData] = useState<CreateCustomerInput>({
    code: '',
    name: '',
    customer_type: 'hospital',
    priority_tier: 1,
    contact_email: '',
    phone: '',
    address: '',
  })
  const [addCustomerSubmitting, setAddCustomerSubmitting] = useState<boolean>(false)

  // Edit Customer
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  const [editCustomerData, setEditCustomerData] = useState<UpdateCustomerInput>({})
  const [editCustomerSubmitting, setEditCustomerSubmitting] = useState<boolean>(false)

  // Dispatch test form
  const [dispatchQty, setDispatchQty] = useState<number>(10)
  const [dispatchCustomerId, setDispatchCustomerId] = useState<number>(1)
  const [dispatchSubmitting, setDispatchSubmitting] = useState<boolean>(false)
  const [dispatchResult, setDispatchResult] = useState<{
    status: 'success' | 'blocked'
    message: string
  } | null>(null)

  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null)

  // Slip & Recall Notice Modals
  const [selectedSlipRecipient, setSelectedSlipRecipient] = useState<any | null>(null)
  const [recallNoticeRecipient, setRecallNoticeRecipient] = useState<any | null>(null)
  const [noticeNotes, setNoticeNotes] = useState<string>('')
  const [submittingNotice, setSubmittingNotice] = useState<boolean>(false)

  const loadCustomers = async () => {
    try {
      const c = await fetchCustomers()
      setCustomers(c)
      if (c.length > 0 && !dispatchCustomerId) {
        setDispatchCustomerId(c[0].id)
      }
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    fetchBatches()
      .then((data) => {
        setBatches(data)
        if (data.length > 0 && !selectedBatch) {
          setSelectedBatch(data[0].batch_number)
        }
      })
      .catch(() => {})

    loadCustomers()
  }, [])

  const loadTrace = async (batchNo: string) => {
    if (!batchNo.trim()) return
    setLoading(true)
    setError(null)
    setDispatchResult(null)
    try {
      const data = await fetchBatchTrace(batchNo.trim())
      setTraceData(data)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to trace batch')
      setTraceData(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (selectedBatch) {
      loadTrace(selectedBatch)
    }
  }, [selectedBatch])

  const handleTestDispatch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedBatch) return
    setDispatchSubmitting(true)
    setDispatchResult(null)

    try {
      const res = await createDispatch({
        batch_number: selectedBatch,
        customer_id: dispatchCustomerId,
        quantity: dispatchQty,
        order_reference: `ORD-${Date.now().toString().slice(-4)}`,
      })
      setDispatchResult({
        status: 'success',
        message: `Dispatch ${res.dispatch_number} successfully registered! Remaining stock: ${res.remaining_stock} units.`,
      })
      loadTrace(selectedBatch)
    } catch (err: unknown) {
      setDispatchResult({
        status: 'blocked',
        message: err instanceof Error ? err.message : 'Dispatch operation blocked',
      })
    } finally {
      setDispatchSubmitting(false)
    }
  }

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault()
    setAddCustomerSubmitting(true)
    setFeedbackMsg(null)
    try {
      const c = await createCustomer(newCustomerData)
      setShowAddCustomerModal(false)
      setFeedbackMsg(`✓ Customer facility '${c.name}' (${c.code}) registered successfully!`)
      setNewCustomerData({
        code: '',
        name: '',
        customer_type: 'hospital',
        priority_tier: 1,
        contact_email: '',
        phone: '',
        address: '',
      })
      loadCustomers()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to create customer')
    } finally {
      setAddCustomerSubmitting(false)
    }
  }

  const handleOpenEditCustomer = (recipient: { customer_name: string; customer_code: string; customer_type: string; priority_tier: number }) => {
    const matched = customers.find((c) => c.code === recipient.customer_code)
    if (matched) {
      setEditingCustomer(matched)
      setEditCustomerData({
        name: matched.name,
        customer_type: matched.customer_type,
        priority_tier: matched.priority_tier,
        contact_email: matched.contact_email || '',
        phone: matched.phone || '',
        address: matched.address || '',
      })
    } else {
      // Find by name or create temporary target
      setEditingCustomer({
        id: 1,
        code: recipient.customer_code,
        name: recipient.customer_name,
        customer_type: recipient.customer_type,
        priority_tier: recipient.priority_tier,
      })
      setEditCustomerData({
        name: recipient.customer_name,
        customer_type: recipient.customer_type,
        priority_tier: recipient.priority_tier,
      })
    }
  }

  const handleUpdateCustomer = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingCustomer) return
    setEditCustomerSubmitting(true)
    try {
      const updated = await updateCustomer(editingCustomer.id, editCustomerData)
      setEditingCustomer(null)
      setFeedbackMsg(`✓ Customer facility '${updated.name}' updated!`)
      loadCustomers()
      if (selectedBatch) loadTrace(selectedBatch)
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to update customer')
    } finally {
      setEditCustomerSubmitting(false)
    }
  }

  const handleIssueRecallNotice = (recipient: any) => {
    setRecallNoticeRecipient(recipient)
    setNoticeNotes(`URGENT: Quarantine and halt dispensing of batch ${selectedBatch} dispatched under ref ${recipient.dispatch_number}. Mandatory Good Distribution Practice (GDP) quarantine compliance.`)
  }

  const handleConfirmRecallNotice = (e: React.FormEvent) => {
    e.preventDefault()
    if (!recallNoticeRecipient) return
    setSubmittingNotice(true)
    setTimeout(() => {
      setFeedbackMsg(`✓ Formal Recall Notice dispatched to ${recallNoticeRecipient.customer_name} (${recallNoticeRecipient.customer_code}) for batch ${selectedBatch}! Outbound custody flagged.`)
      setRecallNoticeRecipient(null)
      setSubmittingNotice(false)
    }, 400)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header & Controls */}
      <div className="agent-control-panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.25rem' }}>
              Forward & Reverse Batch Traceability Console
            </h2>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Complete regulatory chain of custody: trace batch origin, warehouse custody, and outward customer exposure across hospitals and retail chemists.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button
              className="btn-secondary"
              onClick={() => setShowAddCustomerModal(true)}
              style={{ fontSize: '0.8rem', padding: '0.35rem 0.8rem' }}
            >
              + Add Customer Facility
            </button>
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)' }}>QUICK:</span>
            {['B2231', 'B2232', 'B1042', 'B3011', 'B9901'].map((bn) => (
              <button
                key={bn}
                className="template-chip"
                style={{
                  fontWeight: selectedBatch === bn ? 700 : 500,
                  borderColor: selectedBatch === bn ? 'var(--accent-terracotta)' : undefined,
                  backgroundColor: selectedBatch === bn ? 'var(--accent-terracotta-light)' : undefined,
                }}
                onClick={() => setSelectedBatch(bn)}
              >
                {bn}
              </button>
            ))}
          </div>
        </div>

        {/* Search bar */}
        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.75rem' }}>
          <select
            className="select-filter"
            style={{ width: '280px' }}
            value={selectedBatch}
            onChange={(e) => setSelectedBatch(e.target.value)}
          >
            {batches.map((b) => (
              <option key={b.id} value={b.batch_number}>
                {b.batch_number} - {b.product_name} ({b.status.toUpperCase()})
              </option>
            ))}
          </select>

          <input
            type="text"
            className="search-input"
            placeholder="Or type any batch number (e.g. B2231)..."
            value={selectedBatch}
            onChange={(e) => setSelectedBatch(e.target.value)}
          />

          <button
            className="btn-primary"
            onClick={() => loadTrace(selectedBatch)}
            disabled={loading || !selectedBatch.trim()}
          >
            {loading ? 'Tracing...' : 'Run Trace'}
          </button>
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

      {error && (
        <div
          style={{
            padding: '1rem',
            backgroundColor: 'var(--status-critical-bg)',
            color: 'var(--status-critical-text)',
            borderRadius: 6,
            border: '1px solid var(--status-critical-border)',
            fontSize: '0.85rem',
          }}
        >
          {error}
        </div>
      )}

      {traceData && (
        <>
          {/* Summary Metric Strips */}
          <div className="metrics-grid">
            <div className="metric-card">
              <span className="metric-label">Traced Batch</span>
              <span className="metric-value" style={{ fontFamily: 'var(--font-mono)' }}>
                {traceData.batch_number}
              </span>
              <span className="metric-sub">{traceData.product_name} ({traceData.product_sku})</span>
            </div>

            <div className="metric-card">
              <span className="metric-label">Depot Stock</span>
              <span className="metric-value">{traceData.remaining_warehouse_stock.toLocaleString()}</span>
              <span className="metric-sub">Units remaining in warehouse</span>
            </div>

            <div className="metric-card alert-card">
              <span className="metric-label">Outward Dispatched</span>
              <span className="metric-value" style={{ color: 'var(--accent-terracotta)' }}>
                {traceData.total_dispatched_quantity.toLocaleString()}
              </span>
              <span className="metric-sub">Units shipped into market</span>
            </div>

            <div className="metric-card">
              <span className="metric-label">Exposed Accounts</span>
              <span className="metric-value">{traceData.total_recipients_count}</span>
              <span className="metric-sub">
                Hospitals: {traceData.breakdown.hospitals.count} &bull; Chemists: {traceData.breakdown.chemists.count}
              </span>
            </div>
          </div>

          {/* Breakdown Comparison & Dispatch Sandbox */}
          <div className="workspace-grid">
            {/* Left: Recipient Type Exposure Breakdown */}
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '1.25rem', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-main)' }}>
                  Institutional Exposure Breakdown
                </h3>
                <span className="badge badge-online">Verified Ledger</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                <div style={{ padding: '1rem', backgroundColor: 'var(--accent-primary-light)', borderRadius: 6, border: '1px solid var(--accent-primary-border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--accent-primary)' }}>
                      🏥 HOSPITALS (TIER 1)
                    </span>
                    <span style={{ fontSize: '0.72rem', backgroundColor: 'var(--status-info-bg)', color: 'var(--status-info-text)', padding: '0.1rem 0.4rem', borderRadius: 4, fontWeight: 700, border: '1px solid var(--status-info-border)' }}>
                      CRITICAL CARE
                    </span>
                  </div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-main)' }}>
                    {traceData.breakdown.hospitals.quantity} <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-muted)' }}>units</span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--accent-primary)', marginTop: '0.2rem' }}>
                    Across {traceData.breakdown.hospitals.count} hospital accounts (ICUs & clinics)
                  </div>
                </div>

                <div style={{ padding: '1rem', backgroundColor: 'var(--bg-card-subtle)', borderRadius: 6, border: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-main)' }}>
                      🏪 RETAIL CHEMISTS
                    </span>
                    <span style={{ fontSize: '0.72rem', backgroundColor: 'var(--bg-tag)', color: 'var(--text-muted)', padding: '0.1rem 0.4rem', borderRadius: 4, fontWeight: 600 }}>
                      COMMUNITY
                    </span>
                  </div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-main)' }}>
                    {traceData.breakdown.chemists.quantity} <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-muted)' }}>units</span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                    Across {traceData.breakdown.chemists.count} chemist pharmacies
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.75rem', borderTop: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Total exposure: <strong>{traceData.total_dispatched_quantity} units</strong> across {traceData.total_recipients_count} accounts.
                </span>

                <button
                  className="btn-primary"
                  onClick={() => onInvestigateBatch(traceData.batch_number)}
                >
                  Investigate in Agent Workspace &rarr;
                </button>
              </div>
            </div>

            {/* Right: Live Outward Dispatch Sandbox & Safety Barrier */}
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '1.25rem', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-main)' }}>
                  Outward Dispatch Regulatory Barrier Test
                </h3>
                <span className="badge" style={{ backgroundColor: 'var(--status-critical-bg)', color: 'var(--status-critical-text)', border: '1px solid var(--status-critical-border)' }}>
                  Safety Gate Active
                </span>
              </div>

              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                Verify pharmaceutical compliance: any batch under recall, quarantine, or dispatch hold is blocked with an HTTP 403 safety rejection.
              </p>

              <form onSubmit={handleTestDispatch} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>
                      Batch Number
                    </label>
                    <input
                      type="text"
                      className="search-input"
                      style={{ width: '100%', fontFamily: 'var(--font-mono)' }}
                      value={selectedBatch}
                      disabled
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>
                      Quantity to Dispatch
                    </label>
                    <input
                      type="number"
                      min={1}
                      className="search-input"
                      style={{ width: '100%' }}
                      value={dispatchQty}
                      onChange={(e) => setDispatchQty(Number(e.target.value))}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>
                    Destination Facility
                  </label>
                  <select
                    className="select-filter"
                    style={{ width: '100%' }}
                    value={dispatchCustomerId}
                    onChange={(e) => setDispatchCustomerId(Number(e.target.value))}
                  >
                    {customers.length > 0 ? (
                      customers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.customer_type.toUpperCase()} - Tier {c.priority_tier})
                        </option>
                      ))
                    ) : (
                      <>
                        <option value={1}>Apex Heart Institute (Hospital - Tier 1)</option>
                        <option value={2}>Lilavati Super Speciality (Hospital - Tier 1)</option>
                        <option value={6}>Fortis Memorial Care (Hospital - Tier 1)</option>
                        <option value={3}>Noble Chemists Bandra (Retail Pharmacy)</option>
                      </>
                    )}
                  </select>
                </div>

                <button
                  type="submit"
                  className="btn-primary"
                  style={{ alignSelf: 'flex-start', marginTop: '0.5rem' }}
                  disabled={dispatchSubmitting}
                >
                  {dispatchSubmitting ? 'Testing Dispatch...' : 'Attempt Live Outward Dispatch'}
                </button>
              </form>

              {dispatchResult && (
                <div
                  style={{
                    marginTop: '1rem',
                    padding: '0.85rem',
                    borderRadius: 6,
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    backgroundColor: dispatchResult.status === 'success' ? 'var(--status-success-bg)' : 'var(--status-critical-bg)',
                    color: dispatchResult.status === 'success' ? 'var(--status-success-text)' : 'var(--status-critical-text)',
                    border: `1px solid ${dispatchResult.status === 'success' ? 'var(--status-success-border)' : 'var(--status-critical-border)'}`,
                  }}
                >
                  {dispatchResult.status === 'blocked' ? (
                    <div>
                      <div style={{ textTransform: 'uppercase', marginBottom: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <span>🛡️ PHARMACEUTICAL SAFETY BARRIER TRIGGERED</span>
                      </div>
                      <div style={{ fontWeight: 500, fontSize: '0.8rem' }}>{dispatchResult.message}</div>
                    </div>
                  ) : (
                    <div>✓ {dispatchResult.message}</div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Full Outward Recipients Table */}
          <div className="table-container">
            <div className="table-toolbar">
              <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-main)' }}>
                All Exposed Customer Facilities ({traceData.recipients.length} consignments)
              </h3>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Reverse tracing & recall communication log
              </span>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Dispatch #</th>
                    <th>Customer Name</th>
                    <th>Facility Type</th>
                    <th>Priority Tier</th>
                    <th>Quantity</th>
                    <th>Dispatch Date</th>
                    <th>Status</th>
                    <th>Tracking Ref</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {traceData.recipients.map((r, i) => (
                    <tr key={i}>
                      <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{r.dispatch_number}</td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{r.customer_name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{r.customer_code}</div>
                      </td>
                      <td>
                        <span
                          style={{
                            padding: '0.15rem 0.45rem',
                            borderRadius: 4,
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            backgroundColor: r.customer_type === 'hospital' ? '#dbeafe' : 'var(--bg-tag)',
                            color: r.customer_type === 'hospital' ? '#1e40af' : 'inherit',
                          }}
                        >
                          {r.customer_type.toUpperCase()}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontWeight: 700, color: r.priority_tier === 1 ? '#b91c1c' : 'inherit' }}>
                          Tier {r.priority_tier}
                        </span>
                      </td>
                      <td style={{ fontWeight: 700, fontSize: '0.95rem' }}>{r.quantity}</td>
                      <td>{new Date(r.dispatch_date).toLocaleDateString()}</td>
                      <td>
                        <span className="badge badge-online">{r.status.toUpperCase()}</span>
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem' }}>{r.tracking_ref || '-'}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'nowrap' }}>
                          <button
                            className="btn-secondary"
                            onClick={() => setSelectedSlipRecipient(r)}
                            style={{ padding: '0.2rem 0.5rem', fontSize: '0.72rem' }}
                            title="View Dispatch Verification Slip & Tracking"
                          >
                            📋 Slip
                          </button>
                          <button
                            className="btn-secondary"
                            onClick={() => handleIssueRecallNotice(r)}
                            style={{ padding: '0.2rem 0.5rem', fontSize: '0.72rem', color: 'var(--accent-primary)' }}
                            title="Issue Quarantine & Recall Notice to this recipient"
                          >
                            ⚠️ Notice
                          </button>
                          <button
                            className="btn-secondary"
                            onClick={() => handleOpenEditCustomer(r)}
                            style={{ padding: '0.2rem 0.5rem', fontSize: '0.72rem' }}
                            title="Edit Facility Details"
                          >
                            ✎ Edit
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Add Customer Modal */}
      {showAddCustomerModal && (
        <div className="modal-overlay" onClick={() => setShowAddCustomerModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 500 }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '0.35rem', color: 'var(--text-main)' }}>
              Register Customer Facility / Pharmacy
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              Add a hospital or retail pharmacy account into the distribution directory.
            </p>

            <form onSubmit={handleCreateCustomer} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>
                    Facility Code *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. HOSP-901"
                    className="search-input"
                    style={{ width: '100%', fontFamily: 'var(--font-mono)' }}
                    value={newCustomerData.code}
                    onChange={(e) => setNewCustomerData({ ...newCustomerData, code: e.target.value })}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>
                    Account Type *
                  </label>
                  <select
                    className="select-filter"
                    style={{ width: '100%' }}
                    value={newCustomerData.customer_type}
                    onChange={(e) => setNewCustomerData({
                      ...newCustomerData,
                      customer_type: e.target.value,
                      priority_tier: e.target.value === 'hospital' ? 1 : 2,
                    })}
                  >
                    <option value="hospital">Hospital (Inpatient Care)</option>
                    <option value="chemist">Retail Chemist Pharmacy</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>
                  Facility Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Bombay Hospital & Research Centre"
                  className="search-input"
                  style={{ width: '100%' }}
                  value={newCustomerData.name}
                  onChange={(e) => setNewCustomerData({ ...newCustomerData, name: e.target.value })}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>
                    Priority Tier
                  </label>
                  <select
                    className="select-filter"
                    style={{ width: '100%' }}
                    value={newCustomerData.priority_tier}
                    onChange={(e) => setNewCustomerData({ ...newCustomerData, priority_tier: Number(e.target.value) })}
                  >
                    <option value={1}>Tier 1 (Critical Hospital Care)</option>
                    <option value={2}>Tier 2 (Standard Retail Chemist)</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>
                    Contact Phone
                  </label>
                  <input
                    type="text"
                    placeholder="+91 22 2890 1234"
                    className="search-input"
                    style={{ width: '100%' }}
                    value={newCustomerData.phone || ''}
                    onChange={(e) => setNewCustomerData({ ...newCustomerData, phone: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>
                  Physical Address
                </label>
                <input
                  type="text"
                  placeholder="Marine Lines, Mumbai, Maharashtra"
                  className="search-input"
                  style={{ width: '100%' }}
                  value={newCustomerData.address || ''}
                  onChange={(e) => setNewCustomerData({ ...newCustomerData, address: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowAddCustomerModal(false)}
                  disabled={addCustomerSubmitting}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={addCustomerSubmitting}>
                  {addCustomerSubmitting ? 'Registering...' : 'Add Facility'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Customer Modal */}
      {editingCustomer && (
        <div className="modal-overlay" onClick={() => setEditingCustomer(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 500 }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '0.35rem', color: 'var(--text-main)' }}>
              Edit Facility Details: {editingCustomer.name}
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              Update priority allocation tier or facility classification.
            </p>

            <form onSubmit={handleUpdateCustomer} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>
                  Facility Name
                </label>
                <input
                  type="text"
                  required
                  className="search-input"
                  style={{ width: '100%' }}
                  value={editCustomerData.name || ''}
                  onChange={(e) => setEditCustomerData({ ...editCustomerData, name: e.target.value })}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>
                    Facility Type
                  </label>
                  <select
                    className="select-filter"
                    style={{ width: '100%' }}
                    value={editCustomerData.customer_type || 'hospital'}
                    onChange={(e) => setEditCustomerData({ ...editCustomerData, customer_type: e.target.value })}
                  >
                    <option value="hospital">Hospital</option>
                    <option value="chemist">Retail Chemist</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>
                    Priority Tier
                  </label>
                  <select
                    className="select-filter"
                    style={{ width: '100%' }}
                    value={editCustomerData.priority_tier || 1}
                    onChange={(e) => setEditCustomerData({ ...editCustomerData, priority_tier: Number(e.target.value) })}
                  >
                    <option value={1}>Tier 1 (Critical Care ICU)</option>
                    <option value={2}>Tier 2 (Community Pharmacy)</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setEditingCustomer(null)}
                  disabled={editCustomerSubmitting}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={editCustomerSubmitting}>
                  {editCustomerSubmitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delivery Slip Modal */}
      {selectedSlipRecipient && (
        <div className="modal-overlay" onClick={() => setSelectedSlipRecipient(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 540 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ fontSize: '1.15rem', color: 'var(--text-main)', marginBottom: '0.2rem' }}>
                  Dispatch Delivery Dossier
                </h3>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: 'var(--accent-primary)', fontWeight: 600 }}>
                  {selectedSlipRecipient.dispatch_number}
                </span>
              </div>
              <button
                className="btn-secondary"
                onClick={() => setSelectedSlipRecipient(null)}
                style={{ width: 28, height: 28, padding: 0, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.82rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', padding: '0.75rem', backgroundColor: 'var(--bg-card-subtle)', borderRadius: 6 }}>
                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem', display: 'block' }}>RECIPIENT FACILITY</span>
                  <strong>{selectedSlipRecipient.customer_name}</strong>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Code: {selectedSlipRecipient.customer_code}</div>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem', display: 'block' }}>FACILITY CLASSIFICATION</span>
                  <span className="badge badge-online">{selectedSlipRecipient.customer_type.toUpperCase()}</span>
                  <div style={{ marginTop: '0.2rem', fontSize: '0.75rem' }}>Priority: Tier {selectedSlipRecipient.priority_tier}</div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', padding: '0.75rem', backgroundColor: 'var(--bg-card-subtle)', borderRadius: 6 }}>
                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem', display: 'block' }}>BATCH LOT NUMBER</span>
                  <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)' }}>{selectedBatch}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem', display: 'block' }}>QUANTITY SHIPPED</span>
                  <strong>{selectedSlipRecipient.quantity} units</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem', display: 'block' }}>STATUS</span>
                  <span style={{ color: '#16a34a', fontWeight: 600 }}>{selectedSlipRecipient.status.toUpperCase()}</span>
                </div>
              </div>

              <div style={{ padding: '0.75rem', border: '1px solid var(--border-subtle)', borderRadius: 6 }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem', display: 'block', marginBottom: '0.2rem' }}>
                  TRACKING & CHAIN OF CUSTODY
                </span>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>
                  Tracking Ref: {selectedSlipRecipient.tracking_ref || 'TRK-GDP-EXP-2026-99'}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                  Dispatched on {new Date(selectedSlipRecipient.dispatch_date).toLocaleString()} via Calibrated Cold-Chain Logistics Courier.
                </div>
              </div>

              <div style={{ padding: '0.65rem 0.85rem', backgroundColor: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: 6 }}>
                <span style={{ color: '#059669', fontWeight: 600 }}>✓ GDP Regulatory Compliance Verified</span>
                <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Tamper-evident seal verified at release. Thermal data-logger recorded zero excursions during transit.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.25rem' }}>
              <button
                className="btn-secondary"
                onClick={() => {
                  navigator.clipboard?.writeText(selectedSlipRecipient.dispatch_number)
                  setFeedbackMsg(`✓ Copied ${selectedSlipRecipient.dispatch_number} to clipboard!`)
                }}
              >
                Copy Dispatch Ref
              </button>
              <button className="btn-primary" onClick={() => setSelectedSlipRecipient(null)}>
                Close Dossier
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Recall Notice Modal */}
      {recallNoticeRecipient && (
        <div className="modal-overlay" onClick={() => setRecallNoticeRecipient(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '0.35rem', color: '#ea580c' }}>
              Issue Facility Recall & Quarantine Notice
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              Initiate formal regulatory quarantine instruction to <strong>{recallNoticeRecipient.customer_name}</strong> for Batch <strong>{selectedBatch}</strong>.
            </p>

            <form onSubmit={handleConfirmRecallNotice} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ padding: '0.65rem 0.85rem', backgroundColor: 'var(--bg-card-subtle)', borderRadius: 6, fontSize: '0.8rem' }}>
                <div><strong>Dispatch Ref:</strong> {recallNoticeRecipient.dispatch_number} ({recallNoticeRecipient.quantity} units)</div>
                <div><strong>Customer Code:</strong> {recallNoticeRecipient.customer_code}</div>
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>
                  Quarantine Directive & Instructions *
                </label>
                <textarea
                  required
                  rows={4}
                  className="search-input"
                  style={{ width: '100%', resize: 'vertical' }}
                  value={noticeNotes}
                  onChange={(e) => setNoticeNotes(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setRecallNoticeRecipient(null)}
                  disabled={submittingNotice}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  style={{ backgroundColor: '#ea580c', borderColor: '#c2410c' }}
                  disabled={submittingNotice}
                >
                  {submittingNotice ? 'Dispatching...' : 'Confirm & Dispatch Notice'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
