import { useEffect, useState } from 'react'
import type { Product, PurchaseOrder, CreatePurchaseOrderInput } from '../types/arogya'
import { fetchProducts, fetchPurchaseOrders, createPurchaseOrder, updatePurchaseOrderStatus } from '../services/api'

interface ShortagePlanningViewProps {
  onInvestigateShortages: () => void
}

export function ShortagePlanningView({ onInvestigateShortages }: ShortagePlanningViewProps) {
  const [products, setProducts] = useState<Product[]>([])
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([])
  const [showPOModal, setShowPOModal] = useState<boolean>(false)
  const [submittingPO, setSubmittingPO] = useState<boolean>(false)
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null)

  const [newPOData, setNewPOData] = useState<CreatePurchaseOrderInput>({
    product_id: 1,
    quantity: 500,
    unit_price: 25.0,
    notes: 'Urgent recall replacement buffer procurement.',
  })

  // Edit PO state
  const [editingPO, setEditingPO] = useState<PurchaseOrder | null>(null)
  const [editStatus, setEditStatus] = useState<string>('acknowledged')
  const [editNotes, setEditNotes] = useState<string>('')
  const [submittingStatus, setSubmittingStatus] = useState<boolean>(false)

  const loadData = async () => {
    try {
      const [prods, pos] = await Promise.all([fetchProducts(), fetchPurchaseOrders()])
      setProducts(prods)
      setPurchaseOrders(pos)
      if (prods.length > 0) {
        setNewPOData((prev) => ({ ...prev, product_id: prods[0].id, unit_price: prods[0].unit_price }))
      }
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleCreatePO = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmittingPO(true)
    setFeedbackMsg(null)
    try {
      const created = await createPurchaseOrder(newPOData)
      setShowPOModal(false)
      setFeedbackMsg(`✓ Purchase Order ${created.po_number} created for ${created.quantity} units of ${created.product_name}!`)
      loadData()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to create PO')
    } finally {
      setSubmittingPO(false)
    }
  }

  const handleOpenEditStatus = (po: PurchaseOrder) => {
    setEditingPO(po)
    setEditStatus(po.status)
    setEditNotes(po.notes || '')
  }

  const handleCreatePOForShortage = (p: typeof criticalProducts[0]) => {
    const matched = products.find((prod) => prod.sku === p.sku)
    setNewPOData({
      product_id: matched ? matched.id : (products[0]?.id || 1),
      quantity: 500,
      unit_price: matched?.unit_price || 120,
      notes: `Supplier: ${p.preferred_supplier}. Shortage replenishment: ${p.recommended_action}`,
    })
    setShowPOModal(true)
  }

  const handleQuickReceivePO = async (po: PurchaseOrder) => {
    try {
      const updated = await updatePurchaseOrderStatus(po.id, 'received', 'Received at depot via emergency intake.')
      setFeedbackMsg(`✓ Purchase Order ${updated.po_number} marked RECEIVED! Units allocated to active depot inventory.`)
      loadData()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to receive PO')
    }
  }

  const handleUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingPO) return
    setSubmittingStatus(true)
    try {
      const updated = await updatePurchaseOrderStatus(editingPO.id, editStatus, editNotes)
      setEditingPO(null)
      setFeedbackMsg(`✓ Order ${updated.po_number} status updated to [${updated.status.toUpperCase()}].`)
      loadData()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to update PO status')
    } finally {
      setSubmittingStatus(false)
    }
  }

  const criticalProducts = [
    {
      sku: 'MED-AMX-500',
      name: 'Amoxicillin 500mg Capsules',
      molecule: 'Amoxicillin Trihydrate',
      category: 'Antibiotic (Broad Spectrum)',
      is_critical: true,
      depot_stock: 600,
      quarantined_stock: 150, // B2231 recalled
      usable_stock: 450, // B2232
      daily_demand: 4,
      runway_days: 112,
      recall_impact: '350 units need customer replacement; 120 units 30-day demand -> Net 20 unit deficit without PO',
      shortage_risk: 'high',
      preferred_supplier: 'Cipla Ltd',
      recommended_action: 'Draft urgent purchase order for 500 units to prevent stock-out during recall replacement.',
    },
    {
      sku: 'MED-CEF-1G',
      name: 'Ceftriaxone 1g IV Injection',
      molecule: 'Ceftriaxone Sodium',
      category: 'Cephalosporin Antibiotic',
      is_critical: true,
      depot_stock: 470,
      quarantined_stock: 320, // B3011 cold-chain breach
      usable_stock: 150, // B1042 near expiry
      daily_demand: 5,
      runway_days: 30,
      recall_impact: '68% of inventory under dispatch hold due to cold room CR-02 thermal breach',
      shortage_risk: 'critical',
      preferred_supplier: 'Sun Pharma Laboratories Ltd',
      recommended_action: 'Quarantine release dependent on lab stability test; prep expedited order to Sun Pharma.',
    },
    {
      sku: 'MED-MER-1G',
      name: 'Meropenem 1g IV Infusion',
      molecule: 'Meropenem Trihydrate',
      category: 'Carbapenem Antibiotic (Reserve)',
      is_critical: true,
      depot_stock: 280,
      quarantined_stock: 180, // B4022 cold-chain breach
      usable_stock: 100,
      daily_demand: 2,
      runway_days: 50,
      recall_impact: 'Reserve antibiotic. Critical care priority reserve required for hospital ICU wards.',
      shortage_risk: 'medium',
      preferred_supplier: 'Sun Pharma Laboratories Ltd',
      recommended_action: 'Reserve remaining 100 units for Tier 1 hospital accounts; expedite emergency PO.',
    },
    {
      sku: 'MED-MET-500',
      name: 'Metformin 500mg SR Tablets',
      molecule: 'Metformin Hydrochloride',
      category: 'Oral Hypoglycemic',
      is_critical: false,
      depot_stock: 800,
      quarantined_stock: 0,
      usable_stock: 800,
      daily_demand: 8,
      runway_days: 100,
      recall_impact: 'No active regulatory or thermal holds.',
      shortage_risk: 'low',
      preferred_supplier: 'Cipla Ltd',
      recommended_action: 'Standard re-order cycle on schedule.',
    },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Banner */}
      <div className="agent-control-panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.25rem' }}>
              Critical Medicine Shortage & Demand Runway Planning
            </h2>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Evaluate true usable inventory vs clinical demand runways. Simulate recall replacement stress and auto-generate replenishment purchase orders.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              className="btn-secondary"
              onClick={() => setShowPOModal(true)}
              style={{ fontSize: '0.82rem', padding: '0.4rem 0.85rem' }}
            >
              + Create Purchase Order
            </button>
            <button className="btn-primary" onClick={onInvestigateShortages} style={{ fontSize: '0.82rem', padding: '0.4rem 0.95rem' }}>
              ⚡ Run Autonomous Shortage & PO Planning &rarr;
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
          <span className="metric-label">High Shortage Risk Drugs</span>
          <span className="metric-value" style={{ color: 'var(--accent-terracotta)' }}>
            2
          </span>
          <span className="metric-sub">Amoxicillin & Ceftriaxone</span>
        </div>

        <div className="metric-card">
          <span className="metric-label">Cold-Chain Held Units</span>
          <span className="metric-value">500</span>
          <span className="metric-sub">Units unavailable for customer fulfillment</span>
        </div>

        <div className="metric-card">
          <span className="metric-label">Recall Replacement Deficit</span>
          <span className="metric-value">-20</span>
          <span className="metric-sub">Net unit shortfall on B2232</span>
        </div>

        <div className="metric-card">
          <span className="metric-label">Procurement Protocol</span>
          <span className="metric-value" style={{ fontSize: '1.25rem', color: '#166534' }}>
            READY
          </span>
          <span className="metric-sub">Deterministic PO drafting ready for QP sign-off</span>
        </div>
      </div>

      {/* Critical Drug Runway Table */}
      <div className="table-container">
        <div className="table-toolbar">
          <div>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-main)' }}>
              Critical Formulations Demand Runway Analysis
            </h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Usable inventory calculated by subtracting quarantined & held stock from physical depot count
            </p>
          </div>
          <span className="badge badge-online">Live Inventory Math</span>
        </div>

        <table className="data-table">
          <thead>
            <tr>
              <th>Medicine Formulation</th>
              <th>Category</th>
              <th>Physical Depot Stock</th>
              <th>Held / Quarantined</th>
              <th>True Usable Stock</th>
              <th>Runway</th>
              <th>Risk Level</th>
              <th>Recommended Action</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {criticalProducts.map((p) => (
              <tr key={p.sku}>
                <td>
                  <div style={{ fontWeight: 600 }}>{p.name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {p.molecule} &bull; <span style={{ fontFamily: 'var(--font-mono)' }}>{p.sku}</span>
                  </div>
                </td>
                <td>
                  <span style={{ fontSize: '0.78rem' }}>{p.category}</span>
                </td>
                <td style={{ fontWeight: 600 }}>{p.depot_stock}</td>
                <td>
                  <span
                    style={{
                    color: p.quarantined_stock > 0 ? '#b91c1c' : 'var(--text-muted)',
                    fontWeight: p.quarantined_stock > 0 ? 700 : 400,
                  }}
                >
                    {p.quarantined_stock > 0 ? `-${p.quarantined_stock}` : '0'}
                  </span>
                </td>
                <td style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--accent-terracotta)' }}>
                  {p.usable_stock}
                </td>
                <td>
                  <div style={{ fontWeight: 700 }}>{p.runway_days} days</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>~{p.daily_demand} units/day burn</div>
                </td>
                <td>
                  <span
                    style={{
                      padding: '0.15rem 0.45rem',
                      borderRadius: 4,
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      backgroundColor:
                        p.shortage_risk === 'critical'
                          ? 'var(--status-critical-bg)'
                          : p.shortage_risk === 'high'
                          ? 'var(--status-warning-bg)'
                          : 'var(--status-success-bg)',
                      color:
                        p.shortage_risk === 'critical'
                          ? 'var(--status-critical-text)'
                          : p.shortage_risk === 'high'
                          ? 'var(--status-warning-text)'
                          : 'var(--status-success-text)',
                      border: '1px solid currentColor',
                    }}
                  >
                    {p.shortage_risk.toUpperCase()}
                  </span>
                </td>
                <td style={{ fontSize: '0.78rem', maxWidth: 280 }}>
                  <div style={{ color: 'var(--text-main)', marginBottom: '0.2rem' }}>{p.recommended_action}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Supplier: {p.preferred_supplier}</div>
                </td>
                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <button
                    className="btn-primary"
                    onClick={() => handleCreatePOForShortage(p)}
                    style={{ padding: '0.25rem 0.65rem', fontSize: '0.74rem' }}
                    title={`Create emergency replenishment PO for ${p.sku}`}
                  >
                    + Create PO &rarr;
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Live Purchase Orders Ledger */}
      {purchaseOrders.length > 0 && (
        <div className="table-container">
          <div className="table-toolbar">
            <div>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-main)' }}>
                Active Supplier Purchase Orders ({purchaseOrders.length} orders)
              </h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Track emergency replenishments and supplier delivery status
              </p>
            </div>
            <span className="badge badge-online">Supplier Orders</span>
          </div>

          <table className="data-table">
            <thead>
              <tr>
                <th>PO Number</th>
                <th>Order Date</th>
                <th>Product Formulation</th>
                <th>Supplier</th>
                <th>Units Ordered</th>
                <th>Total Value</th>
                <th>Order Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {purchaseOrders.map((po) => (
                <tr key={po.id}>
                  <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{po.po_number}</td>
                  <td>{new Date(po.order_date).toLocaleDateString()}</td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{po.product_name}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>SKU: {po.product_sku}</div>
                  </td>
                  <td>{po.supplier_name}</td>
                  <td style={{ fontWeight: 700 }}>{po.quantity.toLocaleString()}</td>
                  <td style={{ fontWeight: 600, color: 'var(--accent-terracotta)' }}>₹{po.total_amount.toLocaleString()}</td>
                  <td>
                    <span
                      style={{
                        padding: '0.15rem 0.45rem',
                        borderRadius: 4,
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        backgroundColor:
                          po.status === 'received'
                            ? 'var(--status-success-bg)'
                            : po.status === 'in_transit'
                            ? 'var(--status-warning-bg)'
                            : 'var(--bg-tag)',
                        color:
                          po.status === 'received'
                            ? 'var(--status-success-text)'
                            : po.status === 'in_transit'
                            ? 'var(--status-warning-text)'
                            : 'inherit',
                        border: '1px solid currentColor',
                      }}
                    >
                      {po.status.toUpperCase()}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'nowrap' }}>
                      <button
                        className="btn-secondary"
                        onClick={() => handleOpenEditStatus(po)}
                        style={{ padding: '0.2rem 0.5rem', fontSize: '0.72rem' }}
                      >
                        ✎ Update
                      </button>
                      {po.status !== 'received' && (
                        <button
                          className="btn-secondary"
                          onClick={() => handleQuickReceivePO(po)}
                          style={{ padding: '0.2rem 0.5rem', fontSize: '0.72rem', color: '#16a34a' }}
                          title="Mark received and restock warehouse"
                        >
                          📦 Receive
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create PO Modal */}
      {showPOModal && (
        <div className="modal-overlay" onClick={() => setShowPOModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 500 }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '0.35rem', color: 'var(--text-main)' }}>
              Issue Replenishment Purchase Order
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              Create an urgent or routine replenishment order to primary pharmaceutical manufacturer.
            </p>

            <form onSubmit={handleCreatePO} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>
                  Product *
                </label>
                <select
                  className="select-filter"
                  style={{ width: '100%' }}
                  value={newPOData.product_id}
                  onChange={(e) => {
                    const pid = Number(e.target.value)
                    const matched = products.find((p) => p.id === pid)
                    setNewPOData({
                      ...newPOData,
                      product_id: pid,
                      unit_price: matched ? matched.unit_price : newPOData.unit_price,
                    })
                  }}
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.sku}) — ₹{p.unit_price}/unit
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>
                    Order Quantity (Units) *
                  </label>
                  <input
                    type="number"
                    min={50}
                    step={10}
                    required
                    className="search-input"
                    style={{ width: '100%' }}
                    value={newPOData.quantity}
                    onChange={(e) => setNewPOData({ ...newPOData, quantity: Number(e.target.value) })}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>
                    Unit Price (₹)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    className="search-input"
                    style={{ width: '100%' }}
                    value={newPOData.unit_price || 0}
                    onChange={(e) => setNewPOData({ ...newPOData, unit_price: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>
                  Procurement Notes / Special Instructions
                </label>
                <textarea
                  className="prompt-textarea"
                  style={{ minHeight: 65 }}
                  value={newPOData.notes || ''}
                  onChange={(e) => setNewPOData({ ...newPOData, notes: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowPOModal(false)}
                  disabled={submittingPO}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={submittingPO}>
                  {submittingPO ? 'Submitting...' : 'Issue Purchase Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit PO Status Modal */}
      {editingPO && (
        <div className="modal-overlay" onClick={() => setEditingPO(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '0.35rem', color: 'var(--text-main)' }}>
              Update Order Status: {editingPO.po_number}
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              Progress the procurement order through fulfillment stages.
            </p>

            <form onSubmit={handleUpdateStatus} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>
                  Order Status *
                </label>
                <select
                  className="select-filter"
                  style={{ width: '100%' }}
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                >
                  <option value="submitted">Submitted (Awaiting Supplier ACK)</option>
                  <option value="acknowledged">Acknowledged by Manufacturer</option>
                  <option value="in_transit">In Transit (Dispatched from Plant)</option>
                  <option value="received">Received at Depot (Goods Receipt)</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>
                  Status Log Note / AWB Airway Bill
                </label>
                <textarea
                  className="prompt-textarea"
                  style={{ minHeight: 65 }}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="e.g. Dispatched via Blue Dart Air, AWB #902148"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setEditingPO(null)}
                  disabled={submittingStatus}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={submittingStatus}>
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
