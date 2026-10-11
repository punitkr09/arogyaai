import React, { useCallback, useEffect, useState } from 'react'
import type { Supplier, PurchaseOrder, BatchSummary } from '../types/arogya'
import { fetchSuppliersList, fetchSupplierDetail, createSupplier, createPurchaseOrder, fetchProducts } from '../services/api'

export function SupplierManagementView() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [total, setTotal] = useState<number>(0)
  const [loading, setLoading] = useState<boolean>(true)
  const [search, setSearch] = useState<string>('')
  const [page, setPage] = useState<number>(1)
  const pageSize = 20

  // Detail Modal
  const [selectedSupplierId, setSelectedSupplierId] = useState<number | null>(null)
  const [detailLoading, setDetailLoading] = useState<boolean>(false)
  const [supplierDetail, setSupplierDetail] = useState<{
    supplier: Supplier
    purchase_orders: PurchaseOrder[]
    active_inventory: BatchSummary[]
    reorder_recommendation?: Record<string, any>
  } | null>(null)

  // Add Supplier Modal
  const [showAddModal, setShowAddModal] = useState<boolean>(false)
  const [submittingAdd, setSubmittingAdd] = useState<boolean>(false)
  const [newSupplier, setNewSupplier] = useState({
    name: '',
    sku: '',
    lead_time_days: 14,
    min_order_quantity: 500,
    return_window_days: 60,
    contact_email: '',
    phone: '',
  })

  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const loadSuppliers = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetchSuppliersList({
        search: search.trim() || undefined,
        page,
        page_size: pageSize,
      })
      setSuppliers(res.items || [])
      setTotal(res.total || 0)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [search, page])

  useEffect(() => {
    loadSuppliers()
  }, [loadSuppliers])

  const openDetail = async (id: number) => {
    setSelectedSupplierId(id)
    setDetailLoading(true)
    try {
      const d = await fetchSupplierDetail(id)
      setSupplierDetail(d)
    } catch {
      setSupplierDetail(null)
    } finally {
      setDetailLoading(false)
    }
  }

  const closeDetail = () => {
    setSelectedSupplierId(null)
    setSupplierDetail(null)
  }

  const handleCreateSupplier = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newSupplier.name.trim()) {
      alert('Supplier name is required.')
      return
    }

    setSubmittingAdd(true)
    try {
      const created = await createSupplier({
        ...newSupplier,
        name: newSupplier.name.trim(),
        sku: newSupplier.sku.trim().toUpperCase() || undefined,
      })
      setShowAddModal(false)
      setFeedbackMsg({
        type: 'success',
        text: `✓ Supplier '${created.name}' registered successfully!`,
      })
      setNewSupplier({
        name: '',
        sku: '',
        lead_time_days: 14,
        min_order_quantity: 500,
        return_window_days: 60,
        contact_email: '',
        phone: '',
      })
      loadSuppliers()
    } catch (err: unknown) {
      setFeedbackMsg({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to register supplier',
      })
    } finally {
      setSubmittingAdd(false)
    }
  }

  const handleQuickOrderPO = async (s: Supplier) => {
    try {
      const sku = s.sku || (s.product ? s.product.sku : 'MED-AMX-500')
      const prods = await fetchProducts()
      const matched = prods.find((p) => p.sku === sku) || prods[0]
      if (matched) {
        const created = await createPurchaseOrder({
          product_id: matched.id,
          supplier_id: s.id,
          quantity: s.min_order_quantity || 500,
          unit_price: matched.unit_price,
          notes: `Contract replenishment PO to ${s.name} (MOQ ${s.min_order_quantity || 500} units, lead time ${s.lead_time_days || 14} days).`,
        })
        setFeedbackMsg({
          type: 'success',
          text: `✓ Purchase Order ${created.po_number} successfully issued to ${s.name} for ${created.quantity} units!`,
        })
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to issue PO')
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
              backgroundColor: '#4338ca',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.35rem',
              boxShadow: '0 2px 6px rgba(67, 56, 202, 0.25)',
              flexShrink: 0,
            }}
          >
            🏭
          </div>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
              Pharmaceutical Supplier & Vendor Terms Directory
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0.2rem 0 0 0' }}>
              Primary manufacturers, lead times, Minimum Order Quantities (MOQ), and statutory 60-day return windows. Total {total} active suppliers.
            </p>
          </div>
        </div>

        <button
          className="btn-primary"
          onClick={() => setShowAddModal(true)}
          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem', fontSize: '0.82rem' }}
        >
          <span>+</span> Register New Supplier
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

      {/* Toolbar */}
      <div className="table-container" style={{ marginBottom: '1.5rem' }}>
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
          <input
            type="text"
            className="search-input"
            placeholder="Search manufacturer name or SKU..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            style={{ minWidth: 260, flex: '1 1 240px' }}
          />
        </div>

        {/* Table */}
        <div className="table-scroll-container" style={{ overflowX: 'auto', width: '100%' }}>
          {loading ? (
            <div style={{ padding: '3rem 0', textAlign: 'center', color: 'var(--text-muted)' }}>
              Loading supplier terms from database...
            </div>
          ) : suppliers.length === 0 ? (
            <div style={{ padding: '3rem 0', textAlign: 'center', color: 'var(--text-muted)' }}>
              No suppliers found matching criteria.
            </div>
          ) : (
            <table className="data-table" style={{ width: '100%', minWidth: 800 }}>
              <thead>
                <tr>
                  <th>Manufacturer / Supplier</th>
                  <th>Associated SKU</th>
                  <th>Lead Time</th>
                  <th>Min Order Qty (MOQ)</th>
                  <th>RMA Return Window</th>
                  <th>Contact</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {suppliers.map((s) => (
                  <tr key={s.id}>
                    <td style={{ fontWeight: 600, color: 'var(--text-main)' }}>{s.name}</td>
                    <td>
                      <span style={{ fontWeight: 500, color: 'var(--accent-primary)' }}>
                        {s.sku || (s.product ? s.product.sku : '—')}
                      </span>
                    </td>
                    <td>
                      <span
                        style={{
                          color: (s.lead_time_days || 14) > 14 ? '#ea580c' : 'inherit',
                          fontWeight: (s.lead_time_days || 14) > 14 ? 600 : 'normal',
                        }}
                      >
                        {s.lead_time_days || 14} calendar days
                      </span>
                    </td>
                    <td style={{ fontWeight: 500 }}>{s.min_order_quantity || 500} units</td>
                    <td>
                      <span className="badge" style={{ backgroundColor: 'var(--bg-tag)', color: 'var(--text-main)', border: '1px solid var(--border-subtle)' }}>
                        {s.return_window_days || 60} days before expiry
                      </span>
                    </td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {s.contact_email || s.phone || 'orders@pharma-distrib.com'}
                    </td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'flex-end' }}>
                        <button
                          className="btn-primary"
                          onClick={() => handleQuickOrderPO(s)}
                          style={{ padding: '0.25rem 0.65rem', fontSize: '0.75rem' }}
                          title={`Issue replenishment PO to ${s.name}`}
                        >
                          + Order PO
                        </button>
                        <button
                          className="btn-secondary"
                          onClick={() => openDetail(s.id)}
                          style={{ padding: '0.25rem 0.65rem', fontSize: '0.75rem' }}
                        >
                          Details &rarr;
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
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
            Showing {suppliers.length} of {total} suppliers
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

      {/* Supplier Detail Modal */}
      {selectedSupplierId && (
        <div className="modal-backdrop" onClick={closeDetail} role="dialog" aria-modal="true">
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 760, maxHeight: '90vh', overflowY: 'auto', padding: '1.5rem' }}
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
                <h3 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--text-main)' }}>
                  {supplierDetail?.supplier.name}
                </h3>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  SKU Linkage: <strong style={{ color: 'var(--accent-primary)' }}>{supplierDetail?.supplier.sku || 'Multiple Formulations'}</strong>
                </p>
              </div>

              <button className="btn-secondary" onClick={closeDetail} style={{ padding: '0.3rem 0.6rem' }}>
                ✕ Close
              </button>
            </div>

            {detailLoading ? (
              <div style={{ padding: '2rem 0', textAlign: 'center', color: 'var(--text-muted)' }}>
                Loading supplier parameters and purchase history...
              </div>
            ) : supplierDetail ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
                  <div style={{ padding: '0.85rem', borderRadius: 8, background: 'var(--bg-card-subtle)', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Factory Lead Time</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)' }}>
                      {supplierDetail.supplier.lead_time_days || 14} days
                    </div>
                  </div>

                  <div style={{ padding: '0.85rem', borderRadius: 8, background: 'var(--bg-card-subtle)', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Minimum Order Qty</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)' }}>
                      {supplierDetail.supplier.min_order_quantity || 500} units
                    </div>
                  </div>

                  <div style={{ padding: '0.85rem', borderRadius: 8, background: 'var(--bg-card-subtle)', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>RMA Return Policy</div>
                    <div style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--text-main)' }}>
                      {supplierDetail.supplier.return_window_days || 60} days prior to expiry
                    </div>
                  </div>
                </div>

                {/* Purchase Orders */}
                <div>
                  <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: 'var(--text-main)' }}>
                    🛒 Purchase Orders Placed ({supplierDetail.purchase_orders?.length || 0})
                  </h4>
                  {(!supplierDetail.purchase_orders || supplierDetail.purchase_orders.length === 0) ? (
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No historical purchase orders logged for this supplier.</p>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table className="data-table" style={{ fontSize: '0.8rem', width: '100%' }}>
                        <thead>
                          <tr>
                            <th>PO Identifier</th>
                            <th>SKU</th>
                            <th>Quantity</th>
                            <th>Order Date</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {supplierDetail.purchase_orders.map((po) => (
                            <tr key={po.id}>
                              <td style={{ fontWeight: 600 }}>{po.po_number}</td>
                              <td>{po.sku}</td>
                              <td>{po.quantity}</td>
                              <td>{po.order_date?.slice(0, 10)}</td>
                              <td>
                                <span className="badge badge-online">
                                  {po.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Add Supplier Modal */}
      {showAddModal && (
        <div className="modal-backdrop" onClick={() => setShowAddModal(false)} role="dialog" aria-modal="true">
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 500, width: '100%', padding: '1.5rem' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text-main)' }}>
                🏭 Register New Supplier / Manufacturer
              </h3>
              <button
                className="btn-secondary"
                onClick={() => setShowAddModal(false)}
                style={{ width: 28, height: 28, padding: 0 }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSupplier} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>
                  Manufacturer / Supplier Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dr. Reddy's Laboratories"
                  value={newSupplier.name}
                  onChange={(e) => setNewSupplier({ ...newSupplier, name: e.target.value })}
                  style={{ width: '100%', padding: '0.45rem', borderRadius: 6, border: '1px solid var(--border-subtle)' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>
                  Supplied Product SKU (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. PH-010"
                  value={newSupplier.sku}
                  onChange={(e) => setNewSupplier({ ...newSupplier, sku: e.target.value })}
                  style={{ width: '100%', padding: '0.45rem', borderRadius: 6, border: '1px solid var(--border-subtle)' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>
                    Lead Time (Days)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={newSupplier.lead_time_days}
                    onChange={(e) => setNewSupplier({ ...newSupplier, lead_time_days: Number(e.target.value) })}
                    style={{ width: '100%', padding: '0.45rem', borderRadius: 6, border: '1px solid var(--border-subtle)' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>
                    Minimum Order Qty (MOQ)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={newSupplier.min_order_quantity}
                    onChange={(e) => setNewSupplier({ ...newSupplier, min_order_quantity: Number(e.target.value) })}
                    style={{ width: '100%', padding: '0.45rem', borderRadius: 6, border: '1px solid var(--border-subtle)' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>
                  RMA Return Window (Days before expiry)
                </label>
                <input
                  type="number"
                  min="0"
                  value={newSupplier.return_window_days}
                  onChange={(e) => setNewSupplier({ ...newSupplier, return_window_days: Number(e.target.value) })}
                  style={{ width: '100%', padding: '0.45rem', borderRadius: 6, border: '1px solid var(--border-subtle)' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowAddModal(false)}
                  disabled={submittingAdd}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={submittingAdd}
                >
                  {submittingAdd ? 'Saving...' : 'Register Supplier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
