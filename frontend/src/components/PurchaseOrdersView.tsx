import React, { useCallback, useEffect, useState } from 'react'
import type { PurchaseOrder, Product, Supplier, CreatePurchaseOrderInput } from '../types/arogya'
import {
  fetchPurchaseOrdersList,
  fetchPurchaseOrderRecommendations,
  createPurchaseOrder,
  updatePurchaseOrderStatus,
  fetchProducts,
  fetchSuppliersList,
} from '../services/api'

export function PurchaseOrdersView() {
  const [orders, setOrders] = useState<PurchaseOrder[]>([])
  const [total, setTotal] = useState<number>(0)
  const [loading, setLoading] = useState<boolean>(true)
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [overdueOnly, setOverdueOnly] = useState<boolean>(false)
  const [page, setPage] = useState<number>(1)
  const pageSize = 20

  // Tabs
  const [activeTab, setActiveTab] = useState<'orders' | 'recommendations'>('orders')
  const [recommendations, setRecommendations] = useState<Array<{
    sku: string
    product_name: string
    current_stock: number
    min_safety_stock: number
    burn_rate: number
    lead_time_days: number
    supplier_moq: number
    recommended_order_quantity: number
    reason: string
  }>>([])
  const [recLoading, setRecLoading] = useState<boolean>(false)

  // Reference data for PO creation
  const [products, setProducts] = useState<Product[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])

  // Create PO Modal
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false)
  const [submittingCreate, setSubmittingCreate] = useState<boolean>(false)
  const [newPO, setNewPO] = useState<CreatePurchaseOrderInput>({
    product_id: 1,
    supplier_id: undefined,
    quantity: 500,
    unit_price: 25.0,
    notes: 'Routine replenishment order',
  })

  // Update Status Modal
  const [updatingPO, setUpdatingPO] = useState<PurchaseOrder | null>(null)
  const [newStatus, setNewStatus] = useState<string>('Confirmed')
  const [statusNotes, setStatusNotes] = useState<string>('')
  const [submittingStatus, setSubmittingStatus] = useState<boolean>(false)

  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const loadOrders = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetchPurchaseOrdersList({
        status: statusFilter || undefined,
        is_overdue: overdueOnly ? true : undefined,
        page,
        page_size: pageSize,
      })
      setOrders(res.items || [])
      setTotal(res.total || 0)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [statusFilter, overdueOnly, page])

  useEffect(() => {
    loadOrders()
  }, [loadOrders])

  const loadRecommendations = async () => {
    setRecLoading(true)
    try {
      const res = await fetchPurchaseOrderRecommendations()
      setRecommendations(res.recommendations || [])
    } catch {
      setRecommendations([])
    } finally {
      setRecLoading(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'recommendations') {
      loadRecommendations()
    }
  }, [activeTab])

  useEffect(() => {
    fetchProducts().then(setProducts).catch(() => {})
    fetchSuppliersList({ page_size: 100 }).then((res) => setSuppliers(res.items || [])).catch(() => {})
  }, [])

  const handleCreatePO = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmittingCreate(true)
    try {
      const created = await createPurchaseOrder(newPO)
      setShowCreateModal(false)
      setFeedbackMsg({
        type: 'success',
        text: `✓ Purchase Order ${created.po_number} successfully staged for ${created.quantity} units!`,
      })
      loadOrders()
    } catch (err: unknown) {
      setFeedbackMsg({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to create PO',
      })
    } finally {
      setSubmittingCreate(false)
    }
  }

  const handleOpenStatusModal = (po: PurchaseOrder) => {
    setUpdatingPO(po)
    setNewStatus(po.status === 'Open' ? 'Confirmed' : po.status === 'Confirmed' ? 'Received' : po.status)
    setStatusNotes('')
  }

  const handleUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!updatingPO) return
    setSubmittingStatus(true)
    try {
      const updated = await updatePurchaseOrderStatus(updatingPO.id, newStatus, statusNotes || undefined)
      setUpdatingPO(null)
      setFeedbackMsg({
        type: 'success',
        text: `✓ Order ${updated.po_number} status updated to [${updated.status}].`,
      })
      loadOrders()
    } catch (err: unknown) {
      setFeedbackMsg({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to update order status',
      })
    } finally {
      setSubmittingStatus(false)
    }
  }

  const handleQuickReceive = async (po: PurchaseOrder) => {
    try {
      const updated = await updatePurchaseOrderStatus(po.id, 'Received', 'Consignment intake verified by Qualified Person.')
      setFeedbackMsg({
        type: 'success',
        text: `✓ Purchase Order ${updated.po_number} marked RECEIVED! Active depot inventory replenished.`,
      })
      loadOrders()
    } catch (err: unknown) {
      setFeedbackMsg({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to receive order',
      })
    }
  }

  const handleStageFromRecommendation = (r: (typeof recommendations)[0]) => {
    const prod = products.find((p) => p.sku === r.sku)
    const sup = suppliers.find((s) => s.sku === r.sku)

    setNewPO({
      product_id: prod ? prod.id : 1,
      supplier_id: sup ? sup.id : undefined,
      quantity: r.recommended_order_quantity,
      unit_price: prod ? prod.unit_price : 25.0,
      notes: `Automated reorder from intelligence recommendation: ${r.reason}`,
    })
    setShowCreateModal(true)
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
              backgroundColor: '#3b82f6',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.35rem',
              boxShadow: '0 2px 6px rgba(59, 130, 246, 0.25)',
              flexShrink: 0,
            }}
          >
            📋
          </div>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
              Purchase Orders & Factory Replenishment
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0.2rem 0 0 0' }}>
              Inbound supplier consignments, factory lead times, overdue deliveries, and automated replenishment proposals.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            className={`btn-secondary ${activeTab === 'orders' ? 'active' : ''}`}
            onClick={() => setActiveTab('orders')}
            style={activeTab === 'orders' ? { backgroundColor: 'var(--accent-terracotta)', color: '#fff', borderColor: 'var(--accent-terracotta)' } : undefined}
          >
            📦 Active Orders ({total})
          </button>
          <button
            className={`btn-secondary ${activeTab === 'recommendations' ? 'active' : ''}`}
            onClick={() => setActiveTab('recommendations')}
            style={activeTab === 'recommendations' ? { backgroundColor: 'var(--accent-terracotta)', color: '#fff', borderColor: 'var(--accent-terracotta)' } : undefined}
          >
            💡 Automated Reorder Suggestions
          </button>
          <button
            className="btn-primary"
            onClick={() => {
              if (products.length > 0) {
                setNewPO((prev) => ({ ...prev, product_id: products[0].id, unit_price: products[0].unit_price }))
              }
              setShowCreateModal(true)
            }}
            style={{ padding: '0.5rem 1rem', fontSize: '0.82rem' }}
          >
            <span>+</span> Create Purchase Order
          </button>
        </div>
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

      {activeTab === 'orders' && (
        <div className="table-container" style={{ marginBottom: '1.5rem' }}>
          {/* Toolbar */}
          <div
            className="table-toolbar"
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.75rem',
              padding: '0.85rem 1rem',
              borderBottom: '1px solid var(--border-subtle)',
              backgroundColor: 'var(--bg-surface)',
            }}
          >
            <select
              className="select-filter"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value)
                setPage(1)
              }}
            >
              <option value="">All Statuses</option>
              <option value="Received">Received</option>
              <option value="Confirmed">Confirmed</option>
              <option value="Delayed">Delayed</option>
              <option value="Open">Open</option>
            </select>

            <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.82rem', color: 'var(--text-main)', cursor: 'pointer', fontWeight: 500 }}>
              <input
                type="checkbox"
                checked={overdueOnly}
                onChange={(e) => {
                  setOverdueOnly(e.target.checked)
                  setPage(1)
                }}
              />
              Show Overdue Only (Delivery &lt; Reference Date)
            </label>
          </div>

          {/* Table */}
          <div className="table-scroll-container" style={{ overflowX: 'auto', width: '100%' }}>
            {loading ? (
              <div style={{ padding: '3rem 0', textAlign: 'center', color: 'var(--text-muted)' }}>
                Loading purchase orders from database...
              </div>
            ) : orders.length === 0 ? (
              <div style={{ padding: '3rem 0', textAlign: 'center', color: 'var(--text-muted)' }}>
                No purchase orders found matching criteria.
              </div>
            ) : (
              <table className="data-table" style={{ width: '100%', minWidth: 850 }}>
                <thead>
                  <tr>
                    <th>PO Identifier</th>
                    <th>Manufacturer / Supplier</th>
                    <th>SKU</th>
                    <th>Product Formulation</th>
                    <th>Units</th>
                    <th>Expected Delivery</th>
                    <th>Status</th>
                    <th>Total (₹)</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((po) => {
                    const isDelayed = po.status?.toLowerCase().includes('delay')
                    const isReceived = po.status?.toLowerCase() === 'received'
                    return (
                      <tr
                        key={po.id}
                        style={po.is_overdue || isDelayed ? { backgroundColor: 'rgba(239, 68, 68, 0.04)' } : undefined}
                      >
                        <td>
                          <span style={{ fontWeight: 600, color: 'var(--accent-primary)' }}>
                            {po.po_number}
                          </span>
                        </td>
                        <td style={{ fontWeight: 500 }}>{po.manufacturer || po.supplier_name}</td>
                        <td>
                          <span className="badge" style={{ backgroundColor: 'var(--bg-tag)', color: 'var(--text-main)', border: '1px solid var(--border-subtle)' }}>
                            {po.sku || po.product_sku}
                          </span>
                        </td>
                        <td style={{ fontSize: '0.82rem' }}>{po.product_name || po.sku}</td>
                        <td style={{ fontWeight: 600 }}>{po.quantity?.toLocaleString()}</td>
                        <td>
                          <span
                            style={{
                              color: po.is_overdue || isDelayed ? '#ef4444' : 'inherit',
                              fontWeight: po.is_overdue || isDelayed ? 600 : 'normal',
                            }}
                          >
                            {po.expected_delivery_date ? po.expected_delivery_date.slice(0, 10) : '—'}
                            {po.is_overdue && (
                              <span style={{ fontSize: '0.72rem', display: 'block', color: '#ef4444' }}>
                                ⚠️ Overdue delivery
                              </span>
                            )}
                          </span>
                        </td>
                        <td>
                          <span
                            className={`badge ${
                              isReceived
                                ? 'badge-online'
                                : isDelayed || po.is_overdue
                                ? 'badge-offline'
                                : ''
                            }`}
                            style={
                              isDelayed || po.is_overdue
                                ? { backgroundColor: 'var(--status-critical-bg)', color: 'var(--status-critical-text)', border: '1px solid var(--status-critical-border)' }
                                : isReceived
                                ? { backgroundColor: 'var(--status-success-bg)', color: 'var(--status-success-text)', border: '1px solid var(--status-success-border)' }
                                : { backgroundColor: 'var(--status-info-bg)', color: 'var(--status-info-text)', border: '1px solid var(--status-info-border)' }
                            }
                          >
                            {po.status}
                          </span>
                        </td>
                        <td style={{ fontWeight: 500 }}>
                          ₹{(po.total_amount || (po.quantity * (po.unit_price || 0))).toLocaleString()}
                        </td>
                        <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'flex-end' }}>
                            <button
                              className="btn-secondary"
                              onClick={() => handleOpenStatusModal(po)}
                              style={{ padding: '0.25rem 0.65rem', fontSize: '0.75rem' }}
                            >
                              Status &rarr;
                            </button>
                            {po.status?.toLowerCase() !== 'received' && (
                              <button
                                className="btn-secondary"
                                onClick={() => handleQuickReceive(po)}
                                style={{ padding: '0.25rem 0.55rem', fontSize: '0.75rem', color: '#16a34a' }}
                                title="Mark Received & restock inventory"
                              >
                                📦 Receive
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '0.75rem 1rem',
              borderTop: '1px solid var(--border-subtle)',
              fontSize: '0.8rem',
              color: 'var(--text-muted)',
              flexWrap: 'wrap',
              gap: '0.5rem',
            }}
          >
            <span>
              Showing {orders.length} of {total} purchase orders
            </span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                className="btn-secondary"
                disabled={page <= 1}
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                style={{ padding: '0.25rem 0.75rem', fontSize: '0.78rem' }}
              >
                Previous
              </button>
              <button
                className="btn-secondary"
                disabled={page * pageSize >= total}
                onClick={() => setPage((prev) => prev + 1)}
                style={{ padding: '0.25rem 0.75rem', fontSize: '0.78rem' }}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'recommendations' && (
        <div className="table-container" style={{ marginBottom: '1.5rem' }}>
          <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-card-subtle)' }}>
            <h3 style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text-main)' }}>
              🤖 Intelligence Engine Reorder Suggestions
            </h3>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Calculated using live on-hand inventory, 30-day historical dispatch demand, supplier lead times, and Minimum Order Quantities (MOQ).
            </p>
          </div>

          <div className="table-scroll-container" style={{ overflowX: 'auto', width: '100%' }}>
            {recLoading ? (
              <div style={{ padding: '3rem 0', textAlign: 'center', color: 'var(--text-muted)' }}>
                Analyzing stock runway and generating reorder proposals...
              </div>
            ) : recommendations.length === 0 ? (
              <div style={{ padding: '3rem 0', textAlign: 'center', color: '#16a34a' }}>
                ✓ All products have adequate inventory runways exceeding supplier lead times.
              </div>
            ) : (
              <table className="data-table" style={{ width: '100%', minWidth: 900 }}>
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Product Formulation</th>
                    <th>Current Stock</th>
                    <th>Daily Burn</th>
                    <th>Lead Time</th>
                    <th>MOQ</th>
                    <th>Recommended Order</th>
                    <th>Clinical Rationale</th>
                    <th style={{ textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {recommendations.map((r) => (
                    <tr key={r.sku}>
                      <td>
                        <span style={{ fontWeight: 600, color: 'var(--accent-primary)' }}>
                          {r.sku}
                        </span>
                      </td>
                      <td style={{ fontWeight: 500 }}>{r.product_name}</td>
                      <td style={{ color: r.current_stock < r.min_safety_stock ? '#ef4444' : 'inherit', fontWeight: 600 }}>
                        {r.current_stock} units
                      </td>
                      <td>{r.burn_rate} units/day</td>
                      <td>{r.lead_time_days} days</td>
                      <td>{r.supplier_moq} units</td>
                      <td>
                        <strong style={{ color: '#166534', fontSize: '0.9rem' }}>
                          {r.recommended_order_quantity} units
                        </strong>
                      </td>
                      <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)', maxWidth: 280 }}>
                        {r.reason}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          className="btn-primary"
                          onClick={() => handleStageFromRecommendation(r)}
                          style={{ padding: '0.3rem 0.75rem', fontSize: '0.75rem', whiteSpace: 'nowrap' }}
                        >
                          Generate PO &rarr;
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Create Purchase Order Modal */}
      {showCreateModal && (
        <div className="modal-backdrop" onClick={() => setShowCreateModal(false)} role="dialog" aria-modal="true">
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 520, width: '100%', padding: '1.5rem' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text-main)' }}>
                🛒 Create Inbound Purchase Order
              </h3>
              <button
                className="btn-secondary"
                onClick={() => setShowCreateModal(false)}
                style={{ width: 28, height: 28, padding: 0 }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreatePO} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>
                  Target Product *
                </label>
                <select
                  value={newPO.product_id}
                  onChange={(e) => {
                    const pid = Number(e.target.value)
                    const p = products.find((prod) => prod.id === pid)
                    setNewPO({
                      ...newPO,
                      product_id: pid,
                      unit_price: p ? p.unit_price : newPO.unit_price,
                    })
                  }}
                  style={{ width: '100%', padding: '0.45rem', borderRadius: 6, border: '1px solid var(--border-subtle)' }}
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.sku} — {p.name} ({p.brand})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>
                  Preferred Supplier / Manufacturer
                </label>
                <select
                  value={newPO.supplier_id || ''}
                  onChange={(e) => setNewPO({ ...newPO, supplier_id: e.target.value ? Number(e.target.value) : undefined })}
                  style={{ width: '100%', padding: '0.45rem', borderRadius: 6, border: '1px solid var(--border-subtle)' }}
                >
                  <option value="">Default Product Manufacturer</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} (Lead time: {s.lead_time_days}d, MOQ: {s.min_order_quantity})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>
                    Order Quantity (Units) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={newPO.quantity}
                    onChange={(e) => setNewPO({ ...newPO, quantity: Number(e.target.value) })}
                    style={{ width: '100%', padding: '0.45rem', borderRadius: 6, border: '1px solid var(--border-subtle)' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>
                    Unit Price (₹)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={newPO.unit_price}
                    onChange={(e) => setNewPO({ ...newPO, unit_price: Number(e.target.value) })}
                    style={{ width: '100%', padding: '0.45rem', borderRadius: 6, border: '1px solid var(--border-subtle)' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>
                  Procurement Notes / Clinical Rationale
                </label>
                <textarea
                  rows={2}
                  value={newPO.notes || ''}
                  onChange={(e) => setNewPO({ ...newPO, notes: e.target.value })}
                  style={{ width: '100%', padding: '0.45rem', borderRadius: 6, border: '1px solid var(--border-subtle)' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowCreateModal(false)}
                  disabled={submittingCreate}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={submittingCreate}
                >
                  {submittingCreate ? 'Creating Order...' : 'Submit Purchase Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Update PO Status Modal */}
      {updatingPO && (
        <div className="modal-backdrop" onClick={() => setUpdatingPO(null)} role="dialog" aria-modal="true">
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 440, width: '100%', padding: '1.5rem' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text-main)' }}>
                Update PO Status ({updatingPO.po_number})
              </h3>
              <button
                className="btn-secondary"
                onClick={() => setUpdatingPO(null)}
                style={{ width: 28, height: 28, padding: 0 }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateStatus} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>
                  Consignment Status
                </label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  style={{ width: '100%', padding: '0.45rem', borderRadius: 6, border: '1px solid var(--border-subtle)' }}
                >
                  <option value="Confirmed">Confirmed (Factory accepted)</option>
                  <option value="Received">Received (Dock intake & QA release)</option>
                  <option value="Delayed">Delayed (Vendor transit bottleneck)</option>
                  <option value="Open">Open (Pending confirmation)</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>
                  Status Update Notes
                </label>
                <input
                  type="text"
                  placeholder="e.g. Received at Bengaluru warehouse dock with CoA"
                  value={statusNotes}
                  onChange={(e) => setStatusNotes(e.target.value)}
                  style={{ width: '100%', padding: '0.45rem', borderRadius: 6, border: '1px solid var(--border-subtle)' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setUpdatingPO(null)}
                  disabled={submittingStatus}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={submittingStatus}
                >
                  {submittingStatus ? 'Updating...' : 'Update Status'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
