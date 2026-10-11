import React, { useCallback, useEffect, useState } from 'react'
import type { Recall, BatchSummary, Dispatch } from '../types/arogya'
import {
  fetchRecallsList,
  fetchRecallDetail,
  createRecall,
  updateRecallStatus,
  fetchProducts,
} from '../services/api'

interface RecallManagementViewProps {
  onInvestigateRecall?: (batchNumber: string) => void
  onNavigateToTraceability?: (batchNumber: string) => void
}

export function RecallManagementView({
  onInvestigateRecall,
  onNavigateToTraceability,
}: RecallManagementViewProps) {
  const [recalls, setRecalls] = useState<Recall[]>([])
  const [loading, setLoading] = useState<boolean>(true)

  // Detail Modal
  const [selectedRecallId, setSelectedRecallId] = useState<string | null>(null)
  const [detailLoading, setDetailLoading] = useState<boolean>(false)
  const [recallDetail, setRecallDetail] = useState<{
    recall: Recall
    affected_batches: BatchSummary[]
    affected_dispatches: Dispatch[]
    affected_recipients: Array<{ customer_name: string; customer_type: string; quantity: number }>
    total_dispatched_units: number
    total_remaining_warehouse_units: number
  } | null>(null)

  // Initiate Recall Modal
  const [showInitiateModal, setShowInitiateModal] = useState<boolean>(false)
  const [submittingRecall, setSubmittingRecall] = useState<boolean>(false)
  const [newRecall, setNewRecall] = useState({
    sku: 'MED-AMX-500',
    batches: '',
    reason: '',
    recall_class: 'Class II',
  })

  // Close / Resolve Recall Modal
  const [resolvingRecall, setResolvingRecall] = useState<Recall | null>(null)
  const [resolutionNotes, setResolutionNotes] = useState<string>('')
  const [submittingResolve, setSubmittingResolve] = useState<boolean>(false)

  // Available products for dropdown
  const [products, setProducts] = useState<Array<{ sku: string; name: string }>>([])

  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const loadRecalls = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetchRecallsList()
      setRecalls(res.items || [])
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadRecalls()
    fetchProducts()
      .then((prods) => setProducts(prods.map((p) => ({ sku: p.sku, name: p.name }))))
      .catch(() => {})
  }, [loadRecalls])

  const openDetail = async (idOrSku: string) => {
    setSelectedRecallId(idOrSku)
    setDetailLoading(true)
    try {
      const d = await fetchRecallDetail(idOrSku)
      setRecallDetail(d)
    } catch {
      setRecallDetail(null)
    } finally {
      setDetailLoading(false)
    }
  }

  const closeDetail = () => {
    setSelectedRecallId(null)
    setRecallDetail(null)
  }

  const handleCreateRecall = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newRecall.batches.trim() || !newRecall.reason.trim()) {
      alert('Batch number(s) and Regulatory Reason are required.')
      return
    }

    setSubmittingRecall(true)
    try {
      const res = await createRecall({
        sku: newRecall.sku.trim().toUpperCase(),
        batches: newRecall.batches.trim().toUpperCase(),
        reason: newRecall.reason.trim(),
        recall_class: newRecall.recall_class,
      })
      setShowInitiateModal(false)
      setFeedbackMsg({
        type: 'success',
        text: `✓ Regulatory Recall #${res.id} initiated! Outbound dispatch gate locked for affected batch(es).`,
      })
      setNewRecall({
        sku: 'MED-AMX-500',
        batches: '',
        reason: '',
        recall_class: 'Class II',
      })
      loadRecalls()
    } catch (err: unknown) {
      setFeedbackMsg({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to declare recall',
      })
    } finally {
      setSubmittingRecall(false)
    }
  }

  const handleResolveRecall = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!resolvingRecall) return

    setSubmittingResolve(true)
    try {
      await updateRecallStatus(resolvingRecall.id, 'closed', resolutionNotes)
      setResolvingRecall(null)
      setFeedbackMsg({
        type: 'success',
        text: `✓ Recall #${resolvingRecall.id} (${resolvingRecall.sku}) successfully resolved and closed.`,
      })
      loadRecalls()
    } catch (err: unknown) {
      setFeedbackMsg({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to resolve recall',
      })
    } finally {
      setSubmittingResolve(false)
    }
  }

  return (
    <div>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1.25rem',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              backgroundColor: '#dc2626',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.35rem',
              boxShadow: '0 2px 6px rgba(220, 38, 38, 0.25)',
              flexShrink: 0,
            }}
          >
            🚨
          </div>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
              Regulatory Recall Governance &amp; Quarantine Gate
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0.2rem 0 0 0' }}>
              Statutory drug recalls, affected batch containment, mathematical dispatch recipient tracing, and non-negotiable dispatch freezes.
            </p>
          </div>
        </div>

        <button
          className="btn-primary"
          onClick={() => setShowInitiateModal(true)}
          style={{
            backgroundColor: '#dc2626',
            borderColor: '#b91c1c',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.5rem 1rem',
            fontSize: '0.82rem',
          }}
        >
          <span>➕</span> Initiate Regulatory Recall
        </button>
      </div>

      {feedbackMsg && (
        <div
          style={{
            padding: '0.75rem 1rem',
            marginBottom: '1rem',
            borderRadius: 6,
            fontSize: '0.82rem',
            fontWeight: 600,
            backgroundColor: feedbackMsg.type === 'success' ? 'var(--status-success-bg)' : 'var(--status-critical-bg)',
            color: feedbackMsg.type === 'success' ? 'var(--status-success-text)' : 'var(--status-critical-text)',
            border: `1px solid ${feedbackMsg.type === 'success' ? 'var(--status-success-border)' : 'var(--status-critical-border)'}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>{feedbackMsg.text}</span>
          <button
            onClick={() => setFeedbackMsg(null)}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'inherit' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Critical Alert Banner */}
      <div
        style={{
          padding: '1.1rem 1.25rem',
          borderRadius: 8,
          backgroundColor: 'rgba(220, 38, 38, 0.08)',
          border: '1px solid rgba(220, 38, 38, 0.35)',
          marginBottom: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <span style={{ fontSize: '1.15rem' }}>⛔</span>
            <strong style={{ color: '#dc2626', fontSize: '0.95rem' }}>
              Statutory Dispatch Freeze Enforced
            </strong>
            <span className="badge" style={{ backgroundColor: '#dc2626', color: '#fff', fontSize: '0.72rem' }}>
              NON-NEGOTIABLE
            </span>
          </div>
          <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-main)' }}>
            ERP dispatch engine programmatically rejects any outbound picking or billing for recalled batches (e.g. <strong>Batch B2231</strong>, 180 units in Bengaluru Depot). Dispatches to customers are completely blocked by database trigger.
          </p>
        </div>

        {onInvestigateRecall && (
          <button
            className="btn-primary"
            onClick={() => onInvestigateRecall('B2231')}
            style={{ backgroundColor: '#dc2626', borderColor: '#b91c1c', fontSize: '0.82rem', padding: '0.5rem 1rem' }}
          >
            🤖 Run Recall Containment Agent &rarr;
          </button>
        )}
      </div>

      {/* Recalls Table */}
      <div className="table-container" style={{ marginBottom: '1.5rem' }}>
        <div style={{ padding: '0.85rem 1rem', borderBottom: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-surface)' }}>
          <h3 style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text-main)' }}>
            Regulatory Recall Notices ({recalls.length})
          </h3>
        </div>

        <div className="table-scroll-container" style={{ overflowX: 'auto', width: '100%' }}>
          {loading ? (
            <div style={{ padding: '3rem 0', textAlign: 'center', color: 'var(--text-muted)' }}>
              Loading recall records from database...
            </div>
          ) : recalls.length === 0 ? (
            <div style={{ padding: '3rem 0', textAlign: 'center', color: '#16a34a' }}>
              ✓ No active regulatory recalls recorded.
            </div>
          ) : (
            <table className="data-table" style={{ width: '100%', minWidth: 850 }}>
              <thead>
                <tr>
                  <th>Recall Date</th>
                  <th>Product SKU</th>
                  <th>Product Formulation</th>
                  <th>Affected Batch(es)</th>
                  <th>Classification</th>
                  <th>Regulatory Root Cause</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {recalls.map((rec) => {
                  const isActive = rec.status === 'active'
                  return (
                    <tr key={rec.id}>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {rec.recall_date ? rec.recall_date.slice(0, 10) : '—'}
                      </td>
                      <td>
                        <span style={{ fontWeight: 600, color: 'var(--accent-primary)' }}>
                          {rec.sku}
                        </span>
                      </td>
                      <td style={{ fontWeight: 500 }}>{rec.product_name || rec.sku}</td>
                      <td>
                        <span
                          style={{
                            fontFamily: 'var(--font-mono)',
                            fontWeight: 700,
                            color: 'var(--status-critical-text)',
                            background: 'var(--status-critical-bg)',
                            border: '1px solid var(--status-critical-border)',
                            padding: '0.15rem 0.4rem',
                            borderRadius: 4,
                          }}
                        >
                          {rec.batches}
                        </span>
                      </td>
                      <td>
                        <span
                          className="badge"
                          style={{
                            backgroundColor: rec.recall_class?.includes('I') ? 'var(--status-critical-bg)' : 'var(--status-warning-bg)',
                            color: rec.recall_class?.includes('I') ? 'var(--status-critical-text)' : 'var(--status-warning-text)',
                            border: `1px solid ${rec.recall_class?.includes('I') ? 'var(--status-critical-border)' : 'var(--status-warning-border)'}`,
                            fontWeight: 700,
                          }}
                        >
                          {rec.recall_class}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-main)', maxWidth: 300 }}>
                        {rec.reason}
                      </td>
                      <td>
                        <span
                          className="badge"
                          style={{
                            backgroundColor: isActive ? 'var(--status-critical-bg)' : 'var(--status-success-bg)',
                            color: isActive ? 'var(--status-critical-text)' : 'var(--status-success-text)',
                            border: `1px solid ${isActive ? 'var(--status-critical-border)' : 'var(--status-success-border)'}`,
                          }}
                        >
                          {rec.status}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {onNavigateToTraceability && (
                          <button
                            className="btn-secondary"
                            onClick={() => onNavigateToTraceability(rec.batches)}
                            style={{ padding: '0.25rem 0.65rem', fontSize: '0.75rem', marginRight: '0.4rem' }}
                            title={`Trace affected batch ${rec.batches}`}
                          >
                            🔍 Trace
                          </button>
                        )}
                        <button
                          className="btn-secondary"
                          onClick={() => openDetail(String(rec.id))}
                          style={{ padding: '0.25rem 0.65rem', fontSize: '0.75rem', marginRight: '0.4rem' }}
                        >
                          Details &rarr;
                        </button>
                        {isActive && (
                          <button
                            className="btn-secondary"
                            onClick={() => {
                              setResolvingRecall(rec)
                              setResolutionNotes(`Quarantine complete. Disposal verified by Qualified Person.`)
                            }}
                            style={{ padding: '0.25rem 0.65rem', fontSize: '0.75rem', color: '#16a34a' }}
                            title="Resolve and close this recall"
                          >
                            Close
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Recall Detail Modal */}
      {selectedRecallId && (
        <div className="modal-backdrop" onClick={closeDetail} role="dialog" aria-modal="true">
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 840, maxHeight: '90vh', overflowY: 'auto', padding: '1.5rem' }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                borderBottom: '1px solid var(--border-subtle)',
                paddingBottom: '0.75rem',
                marginBottom: '1rem',
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#dc2626' }}>
                  🚨 Recall Reconciliation #{selectedRecallId}
                </h3>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  SKU: <strong>{recallDetail?.recall?.sku}</strong> &bull; Batch: <strong>{recallDetail?.recall?.batches}</strong> &bull; Classification: {recallDetail?.recall?.recall_class}
                </p>
              </div>

              <button className="btn-secondary" onClick={closeDetail} style={{ padding: '0.3rem 0.6rem' }}>
                ✕ Close
              </button>
            </div>

            {detailLoading ? (
              <div style={{ padding: '2rem 0', textAlign: 'center', color: 'var(--text-muted)' }}>
                Tracing recipient consignments and warehouse quarantine records...
              </div>
            ) : recallDetail ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div style={{ padding: '0.85rem', backgroundColor: 'var(--status-critical-bg)', borderRadius: 8, border: '1px solid var(--status-critical-border)' }}>
                  <strong style={{ color: 'var(--status-critical-text)', fontSize: '0.85rem' }}>Regulatory Reason:</strong>
                  <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.82rem', color: 'var(--status-critical-text)' }}>
                    {recallDetail.recall.reason}
                  </p>
                </div>

                {/* Recipient Breakdown */}
                <div>
                  <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: 'var(--text-main)' }}>
                    🏥 Downstream Recipient Distribution ({recallDetail.affected_recipients?.length || 0} facilities)
                  </h4>
                  {(!recallDetail.affected_recipients || recallDetail.affected_recipients.length === 0) ? (
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      No dispatched units traced to external customers. Stock remained quarantined inside warehouse depot.
                    </p>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table className="data-table" style={{ fontSize: '0.8rem', width: '100%' }}>
                        <thead>
                          <tr>
                            <th>Recipient Facility</th>
                            <th>Facility Type</th>
                            <th>Quantity Received</th>
                          </tr>
                        </thead>
                        <tbody>
                          {recallDetail.affected_recipients.map((recip, idx) => (
                            <tr key={idx}>
                              <td style={{ fontWeight: 600 }}>{recip.customer_name}</td>
                              <td>{recip.customer_type}</td>
                              <td style={{ fontWeight: 600, color: '#dc2626' }}>{recip.quantity} units</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Agent Trigger */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', paddingTop: '0.5rem' }}>
                  {onInvestigateRecall && (
                    <button
                      className="btn-primary"
                      onClick={() => {
                        closeDetail()
                        onInvestigateRecall(recallDetail.recall.batches)
                      }}
                      style={{ fontSize: '0.82rem', padding: '0.5rem 1rem' }}
                    >
                      🤖 Run Agent Investigation on {recallDetail.recall.batches} &rarr;
                    </button>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Initiate Recall Modal */}
      {showInitiateModal && (
        <div className="modal-backdrop" onClick={() => setShowInitiateModal(false)} role="dialog" aria-modal="true">
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 520, width: '100%', padding: '1.5rem' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#dc2626' }}>
                🚨 Initiate Regulatory Batch Recall
              </h3>
              <button
                className="btn-secondary"
                onClick={() => setShowInitiateModal(false)}
                style={{ width: 28, height: 28, padding: 0 }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateRecall} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>
                  Target Product SKU *
                </label>
                <select
                  value={newRecall.sku}
                  onChange={(e) => setNewRecall({ ...newRecall, sku: e.target.value })}
                  style={{ width: '100%', padding: '0.45rem', borderRadius: 6, border: '1px solid var(--border-subtle)' }}
                >
                  {products.map((p) => (
                    <option key={p.sku} value={p.sku}>
                      {p.sku} — {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>
                  Affected Batch Number(s) * (comma-separated)
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. B2231, B2232"
                  value={newRecall.batches}
                  onChange={(e) => setNewRecall({ ...newRecall, batches: e.target.value })}
                  style={{ width: '100%', padding: '0.45rem', borderRadius: 6, border: '1px solid var(--border-subtle)' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>
                  Recall Classification *
                </label>
                <select
                  value={newRecall.recall_class}
                  onChange={(e) => setNewRecall({ ...newRecall, recall_class: e.target.value })}
                  style={{ width: '100%', padding: '0.45rem', borderRadius: 6, border: '1px solid var(--border-subtle)' }}
                >
                  <option value="Class I">Class I (Dangerous / Defective with serious health consequences)</option>
                  <option value="Class II">Class II (Temporary or medically reversible health adverse)</option>
                  <option value="Class III">Class III (Unlikely to cause adverse health consequences)</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>
                  Regulatory Root Cause / Defect Reason *
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="e.g. Retrospective dissolution failure detected during stability monitoring."
                  value={newRecall.reason}
                  onChange={(e) => setNewRecall({ ...newRecall, reason: e.target.value })}
                  style={{ width: '100%', padding: '0.45rem', borderRadius: 6, border: '1px solid var(--border-subtle)' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowInitiateModal(false)}
                  disabled={submittingRecall}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={submittingRecall}
                  style={{ backgroundColor: '#dc2626', borderColor: '#b91c1c' }}
                >
                  {submittingRecall ? 'Locking Inventory...' : 'Declare Recall & Freeze Dispatches'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Resolve Recall Modal */}
      {resolvingRecall && (
        <div className="modal-backdrop" onClick={() => setResolvingRecall(null)} role="dialog" aria-modal="true">
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 460, width: '100%', padding: '1.5rem' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text-main)' }}>
                Resolve Recall #{resolvingRecall.id}
              </h3>
              <button
                className="btn-secondary"
                onClick={() => setResolvingRecall(null)}
                style={{ width: 28, height: 28, padding: 0 }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleResolveRecall} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0 }}>
                Closing this recall confirms that all recipient containment notices have been confirmed and quarantined units in warehouse have been slated for authorized bio-quarantine destruction.
              </p>

              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>
                  Resolution Notes
                </label>
                <textarea
                  rows={3}
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  style={{ width: '100%', padding: '0.45rem', borderRadius: 6, border: '1px solid var(--border-subtle)' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setResolvingRecall(null)}
                  disabled={submittingResolve}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={submittingResolve}
                >
                  {submittingResolve ? 'Closing...' : 'Confirm Resolution'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
