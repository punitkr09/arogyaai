import { useCallback, useEffect, useState } from 'react'
import type {
  BatchSummary,
  BatchDetail,
  Product,
  Warehouse,
  CreateBatchInput,
  UpdateBatchInput,
  CreateProductInput,
} from '../types/arogya'
import {
  fetchBatches,
  fetchBatchDetails,
  fetchProducts,
  fetchWarehouses,
  createBatch,
  updateBatch,
  createProduct,
} from '../services/api'

interface BatchExplorerProps {
  onInvestigateBatch?: (batchNumber: string) => void
}

export function BatchExplorer({ onInvestigateBatch }: BatchExplorerProps) {
  const [batches, setBatches] = useState<BatchSummary[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [search, setSearch] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [warehouseFilter, setWarehouseFilter] = useState<string>('')

  // Reference data
  const [products, setProducts] = useState<Product[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])

  // Detail Modal state
  const [selectedBatchNumber, setSelectedBatchNumber] = useState<string | null>(null)
  const [detail, setDetail] = useState<BatchDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState<boolean>(false)

  // Add Batch Modal state
  const [showAddBatchModal, setShowAddBatchModal] = useState<boolean>(false)
  const [newBatchData, setNewBatchData] = useState<CreateBatchInput>({
    batch_number: '',
    product_id: 1,
    warehouse_id: 1,
    available_quantity: 500,
    initial_quantity: 500,
    expiry_date: '2027-06-30',
    status: 'active',
    storage_condition: 'Controlled Room Temp (15-25°C)',
  })
  const [addBatchSubmitting, setAddBatchSubmitting] = useState<boolean>(false)

  // Edit Batch Modal state
  const [editingBatch, setEditingBatch] = useState<BatchSummary | null>(null)
  const [editBatchData, setEditBatchData] = useState<UpdateBatchInput>({})
  const [editBatchSubmitting, setEditBatchSubmitting] = useState<boolean>(false)

  // Add Product Modal state
  const [showAddProductModal, setShowAddProductModal] = useState<boolean>(false)
  const [newProductData, setNewProductData] = useState<CreateProductInput>({
    sku: '',
    name: '',
    molecule: '',
    brand: '',
    category: 'Antibiotic',
    storage_range: '15°C - 25°C',
    is_critical: false,
    unit_price: 25.0,
    min_safety_stock: 100,
  })
  const [addProductSubmitting, setAddProductSubmitting] = useState<boolean>(false)

  const [actionFeedback, setActionFeedback] = useState<string | null>(null)

  const loadBatches = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchBatches(search, statusFilter, warehouseFilter)
      setBatches(data)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [search, statusFilter, warehouseFilter])

  useEffect(() => {
    loadBatches()
  }, [loadBatches])

  useEffect(() => {
    fetchProducts()
      .then((p) => {
        setProducts(p)
        if (p.length > 0) {
          setNewBatchData((prev) => ({ ...prev, product_id: p[0].id }))
        }
      })
      .catch(() => {})

    fetchWarehouses()
      .then((w) => {
        setWarehouses(w)
        if (w.length > 0) {
          setNewBatchData((prev) => ({ ...prev, warehouse_id: w[0].id }))
        }
      })
      .catch(() => {})
  }, [])

  const handleOpenDetail = async (batchNumber: string) => {
    setSelectedBatchNumber(batchNumber)
    setDetailLoading(true)
    try {
      const res = await fetchBatchDetails(batchNumber)
      setDetail(res)
    } catch {
      // ignore
    } finally {
      setDetailLoading(false)
    }
  }

  const handleCloseDetailModal = () => {
    setSelectedBatchNumber(null)
    setDetail(null)
  }

  // Handle Add Batch
  const handleCreateBatch = async (e: React.FormEvent) => {
    e.preventDefault()
    setAddBatchSubmitting(true)
    setActionFeedback(null)
    try {
      const created = await createBatch(newBatchData)
      setShowAddBatchModal(false)
      setActionFeedback(`✓ Batch ${created.batch_number} created successfully with ${created.available_quantity} units!`)
      setNewBatchData({
        batch_number: '',
        product_id: products[0]?.id || 1,
        warehouse_id: warehouses[0]?.id || 1,
        available_quantity: 500,
        initial_quantity: 500,
        expiry_date: '2027-06-30',
        status: 'active',
        storage_condition: 'Controlled Room Temp (15-25°C)',
      })
      loadBatches()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to create batch')
    } finally {
      setAddBatchSubmitting(false)
    }
  }

  // Handle Edit Batch
  const handleOpenEditModal = (batch: BatchSummary) => {
    setEditingBatch(batch)
    setEditBatchData({
      available_quantity: batch.available_quantity,
      status: batch.status,
      warehouse_id: warehouses.find((w) => w.code === batch.warehouse_code)?.id || 1,
      expiry_date: batch.expiry_date.split('T')[0],
      storage_condition: batch.storage_condition,
    })
  }

  const handleUpdateBatch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingBatch) return
    setEditBatchSubmitting(true)
    setActionFeedback(null)
    try {
      const updated = await updateBatch(editingBatch.batch_number, editBatchData)
      setEditingBatch(null)
      setActionFeedback(`✓ Batch ${updated.batch_number} updated: status [${updated.status.toUpperCase()}], quantity ${updated.available_quantity}`)
      loadBatches()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to update batch')
    } finally {
      setEditBatchSubmitting(false)
    }
  }

  // Handle Add Product
  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault()
    setAddProductSubmitting(true)
    setActionFeedback(null)
    try {
      const created = await createProduct(newProductData)
      setShowAddProductModal(false)
      setActionFeedback(`✓ Product ${created.name} (${created.sku}) added to master catalog!`)
      setNewProductData({
        sku: '',
        name: '',
        molecule: '',
        brand: '',
        category: 'Antibiotic',
        storage_range: '15°C - 25°C',
        is_critical: false,
        unit_price: 25.0,
        min_safety_stock: 100,
      })
      const p = await fetchProducts()
      setProducts(p)
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to create product')
    } finally {
      setAddProductSubmitting(false)
    }
  }

  return (
    <div>
      {/* Top action strip */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.2rem' }}>
            Batch Inventory Ledger & Lot Governance
          </h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Physical depot bin allocations, lot status containment, and outward movement ledgers.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            className="btn-secondary"
            onClick={() => setShowAddProductModal(true)}
            style={{ fontSize: '0.82rem', padding: '0.4rem 0.85rem' }}
          >
            + Add Product SKU
          </button>
          <button
            className="btn-primary"
            onClick={() => setShowAddBatchModal(true)}
            style={{ fontSize: '0.82rem', padding: '0.4rem 0.95rem' }}
          >
            + Add New Batch Lot
          </button>
        </div>
      </div>

      {actionFeedback && (
        <div
          style={{
            padding: '0.75rem 1rem',
            backgroundColor: 'var(--status-success-bg)',
            color: 'var(--status-success-text)',
            borderRadius: 6,
            border: '1px solid var(--status-success-border)',
            fontSize: '0.82rem',
            fontWeight: 600,
            marginBottom: '1rem',
          }}
        >
          {actionFeedback}
        </div>
      )}

      <div className="table-container">
        <div className="table-toolbar">
          <input
            type="text"
            className="search-input"
            placeholder="Search by batch number, brand, molecule..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <select
              className="select-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="dispatch_hold">Dispatch Hold</option>
              <option value="quarantine">Quarantine</option>
              <option value="recalled">Recalled</option>
            </select>

            <select
              className="select-filter"
              value={warehouseFilter}
              onChange={(e) => setWarehouseFilter(e.target.value)}
            >
              <option value="">All Warehouses</option>
              <option value="WH-CENTRAL">Central Depot (Bhiwandi)</option>
              <option value="WH-NORTH">North Cold Facility (NCR)</option>
              <option value="WH-WEST">West Coast Express (Pune)</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            Loading inventory records...
          </div>
        ) : batches.length === 0 ? (
          <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            No batches matching search filters.
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Batch Number</th>
                <th>Product & Molecule</th>
                <th>Warehouse Location</th>
                <th>Available Qty</th>
                <th>Expiry Horizon</th>
                <th>Storage Specs</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {batches.map((b) => (
                <tr key={b.id}>
                  <td>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                      {b.batch_number}
                    </span>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{b.product_name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>SKU: {b.product_sku}</div>
                  </td>
                  <td>
                    <div>{b.warehouse_name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{b.warehouse_code}</div>
                  </td>
                  <td>
                    <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                      {b.available_quantity.toLocaleString()}
                    </span>{' '}
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>/ {b.initial_quantity}</span>
                  </td>
                  <td>
                    <div>{new Date(b.expiry_date).toLocaleDateString()}</div>
                    <span
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        color: b.days_to_expiry <= 45 ? '#b91c1c' : b.days_to_expiry <= 90 ? '#b45309' : '#15803d',
                      }}
                    >
                      {b.days_to_expiry > 0 ? `${b.days_to_expiry} days remaining` : 'EXPIRED'}
                    </span>
                  </td>
                  <td>
                    <span style={{ fontSize: '0.78rem' }}>{b.storage_condition}</span>
                  </td>
                  <td>
                    <span
                      style={{
                        padding: '0.2rem 0.5rem',
                        borderRadius: 4,
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        backgroundColor:
                          b.status === 'active'
                            ? 'var(--status-success-bg)'
                            : b.status === 'dispatch_hold'
                            ? 'var(--status-warning-bg)'
                            : 'var(--status-critical-bg)',
                        color:
                          b.status === 'active'
                            ? 'var(--status-success-text)'
                            : b.status === 'dispatch_hold'
                            ? 'var(--status-warning-text)'
                            : 'var(--status-critical-text)',
                        border: '1px solid currentColor',
                      }}
                    >
                      {b.status.toUpperCase()}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.35rem' }}>
                      <button
                        className="btn-secondary"
                        onClick={() => handleOpenEditModal(b)}
                        style={{ padding: '0.25rem 0.55rem', fontSize: '0.75rem' }}
                        title="Edit batch quantity, status or specs"
                      >
                        ✎ Edit
                      </button>
                      <button
                        className="btn-secondary"
                        onClick={() => handleOpenDetail(b.batch_number)}
                        style={{ padding: '0.25rem 0.55rem', fontSize: '0.75rem' }}
                      >
                        Ledger &rarr;
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Batch Detail Modal / Drawer */}
      {selectedBatchNumber && (
        <div className="modal-overlay" onClick={handleCloseDetailModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ fontSize: '1.15rem', color: 'var(--text-main)', marginBottom: '0.25rem' }}>
                  Batch Audit Dossier: <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-terracotta)' }}>{selectedBatchNumber}</span>
                </h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Complete chronological movements and outward customer dispatch history.
                </p>
              </div>
              <button
                onClick={handleCloseDetailModal}
                style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                &times;
              </button>
            </div>

            {detailLoading ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                Loading ledger records...
              </div>
            ) : detail ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', background: 'var(--bg-card-subtle)', padding: '0.85rem', borderRadius: 6 }}>
                  <div>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block' }}>WAREHOUSE STOCK</span>
                    <span style={{ fontSize: '1.2rem', fontWeight: 700 }}>{detail.batch.available_quantity} units</span>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block' }}>TOTAL DISPATCHED (30D)</span>
                    <span style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--accent-terracotta)' }}>{detail.total_dispatched} units</span>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block' }}>RECIPIENTS COUNT</span>
                    <span style={{ fontSize: '1.2rem', fontWeight: 700 }}>{detail.dispatches.length} accounts</span>
                  </div>
                </div>

                {/* Movements */}
                <div>
                  <h4 style={{ fontSize: '0.9rem', marginBottom: '0.5rem', color: 'var(--text-main)' }}>Stock Movements Ledger</h4>
                  <div style={{ maxHeight: 150, overflowY: 'auto', border: '1px solid var(--border-subtle)', borderRadius: 6 }}>
                    <table className="data-table" style={{ fontSize: '0.78rem' }}>
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Movement Type</th>
                          <th>Quantity</th>
                          <th>Reference Doc</th>
                          <th>Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.movements.map((m) => (
                          <tr key={m.id}>
                            <td>{new Date(m.timestamp).toLocaleDateString()}</td>
                            <td style={{ fontWeight: 600 }}>{m.movement_type}</td>
                            <td style={{ fontWeight: 700 }}>{m.quantity > 0 ? `+${m.quantity}` : m.quantity}</td>
                            <td style={{ fontFamily: 'var(--font-mono)' }}>{m.reference_doc}</td>
                            <td style={{ color: 'var(--text-muted)' }}>{m.notes || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Dispatches */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <h4 style={{ fontSize: '0.9rem', color: 'var(--text-main)' }}>
                      Customer Outward Dispatches ({detail.dispatches.length} recipients)
                    </h4>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Sum: <strong>{detail.total_dispatched}</strong> units
                    </span>
                  </div>

                  <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid var(--border-subtle)', borderRadius: 6 }}>
                    <table className="data-table" style={{ fontSize: '0.78rem' }}>
                      <thead>
                        <tr>
                          <th>Dispatch #</th>
                          <th>Customer Recipient</th>
                          <th>Type</th>
                          <th>Qty</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.dispatches.map((d) => (
                          <tr key={d.id}>
                            <td style={{ fontFamily: 'var(--font-mono)' }}>{d.dispatch_number}</td>
                            <td style={{ fontWeight: 600 }}>{d.customer_name}</td>
                            <td>
                              <span
                                style={{
                                  padding: '0.1rem 0.35rem',
                                  borderRadius: 4,
                                  fontSize: '0.7rem',
                                  backgroundColor: d.customer_type === 'hospital' ? '#dbeafe' : 'var(--bg-tag)',
                                  color: d.customer_type === 'hospital' ? '#1e40af' : 'inherit',
                                  fontWeight: 600,
                                }}
                              >
                                {d.customer_type.toUpperCase()}
                              </span>
                            </td>
                            <td style={{ fontWeight: 700 }}>{d.quantity}</td>
                            <td>{d.status}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                  {onInvestigateBatch && (
                    <button
                      className="btn-primary"
                      onClick={() => {
                        handleCloseDetailModal()
                        onInvestigateBatch(selectedBatchNumber)
                      }}
                    >
                      Investigate with Agent &rarr;
                    </button>
                  )}
                  <button className="btn-secondary" onClick={handleCloseDetailModal}>
                    Close
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Add Batch Modal */}
      {showAddBatchModal && (
        <div className="modal-overlay" onClick={() => setShowAddBatchModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 540 }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '0.35rem', color: 'var(--text-main)' }}>
              Add New Batch Lot to Inventory
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              Register incoming manufactured lot, assign warehouse bin location and initial status.
            </p>

            <form onSubmit={handleCreateBatch} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>
                    Batch Number *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. B5521"
                    className="search-input"
                    style={{ width: '100%', fontFamily: 'var(--font-mono)' }}
                    value={newBatchData.batch_number}
                    onChange={(e) => setNewBatchData({ ...newBatchData, batch_number: e.target.value })}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>
                    Product SKU *
                  </label>
                  <select
                    className="select-filter"
                    style={{ width: '100%' }}
                    value={newBatchData.product_id}
                    onChange={(e) => setNewBatchData({ ...newBatchData, product_id: Number(e.target.value) })}
                  >
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.sku})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>
                    Warehouse Facility *
                  </label>
                  <select
                    className="select-filter"
                    style={{ width: '100%' }}
                    value={newBatchData.warehouse_id}
                    onChange={(e) => setNewBatchData({ ...newBatchData, warehouse_id: Number(e.target.value) })}
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
                    Initial Stock Quantity *
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    className="search-input"
                    style={{ width: '100%' }}
                    value={newBatchData.available_quantity}
                    onChange={(e) => setNewBatchData({
                      ...newBatchData,
                      available_quantity: Number(e.target.value),
                      initial_quantity: Number(e.target.value),
                    })}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>
                    Expiry Date *
                  </label>
                  <input
                    type="date"
                    required
                    className="search-input"
                    style={{ width: '100%' }}
                    value={newBatchData.expiry_date}
                    onChange={(e) => setNewBatchData({ ...newBatchData, expiry_date: e.target.value })}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>
                    Initial Status *
                  </label>
                  <select
                    className="select-filter"
                    style={{ width: '100%' }}
                    value={newBatchData.status}
                    onChange={(e) => setNewBatchData({ ...newBatchData, status: e.target.value })}
                  >
                    <option value="active">Active (Available for Dispatch)</option>
                    <option value="dispatch_hold">Dispatch Hold (Pending QA)</option>
                    <option value="quarantine">Quarantine (Isolation)</option>
                    <option value="recalled">Recalled (Regulatory Lock)</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>
                  Storage Condition Specifications
                </label>
                <input
                  type="text"
                  className="search-input"
                  style={{ width: '100%' }}
                  value={newBatchData.storage_condition}
                  onChange={(e) => setNewBatchData({ ...newBatchData, storage_condition: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowAddBatchModal(false)}
                  disabled={addBatchSubmitting}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={addBatchSubmitting}>
                  {addBatchSubmitting ? 'Registering...' : 'Confirm & Register Batch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Batch Modal */}
      {editingBatch && (
        <div className="modal-overlay" onClick={() => setEditingBatch(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '0.35rem', color: 'var(--text-main)' }}>
              Edit Batch: <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-terracotta)' }}>{editingBatch.batch_number}</span>
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              Modify current lot status, adjust physical available quantity, or update facility location.
            </p>

            <form onSubmit={handleUpdateBatch} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>
                  Batch Status *
                </label>
                <select
                  className="select-filter"
                  style={{ width: '100%' }}
                  value={editBatchData.status}
                  onChange={(e) => setEditBatchData({ ...editBatchData, status: e.target.value })}
                >
                  <option value="active">Active (Available for Dispatch)</option>
                  <option value="dispatch_hold">Dispatch Hold (Quality Hold)</option>
                  <option value="quarantine">Quarantine (Isolation Lock)</option>
                  <option value="recalled">Recalled (Regulatory Freeze)</option>
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>
                    Available Quantity
                  </label>
                  <input
                    type="number"
                    min={0}
                    required
                    className="search-input"
                    style={{ width: '100%' }}
                    value={editBatchData.available_quantity ?? 0}
                    onChange={(e) => setEditBatchData({ ...editBatchData, available_quantity: Number(e.target.value) })}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>
                    Warehouse Facility
                  </label>
                  <select
                    className="select-filter"
                    style={{ width: '100%' }}
                    value={editBatchData.warehouse_id}
                    onChange={(e) => setEditBatchData({ ...editBatchData, warehouse_id: Number(e.target.value) })}
                  >
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({w.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>
                    Expiry Date
                  </label>
                  <input
                    type="date"
                    required
                    className="search-input"
                    style={{ width: '100%' }}
                    value={editBatchData.expiry_date || ''}
                    onChange={(e) => setEditBatchData({ ...editBatchData, expiry_date: e.target.value })}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>
                    Storage Condition
                  </label>
                  <input
                    type="text"
                    className="search-input"
                    style={{ width: '100%' }}
                    value={editBatchData.storage_condition || ''}
                    onChange={(e) => setEditBatchData({ ...editBatchData, storage_condition: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setEditingBatch(null)}
                  disabled={editBatchSubmitting}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={editBatchSubmitting}>
                  {editBatchSubmitting ? 'Saving...' : 'Save Batch Updates'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Product Modal */}
      {showAddProductModal && (
        <div className="modal-overlay" onClick={() => setShowAddProductModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 540 }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '0.35rem', color: 'var(--text-main)' }}>
              Add Product to Master Catalog
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              Create a new pharmaceutical SKU with molecule, storage conditions and safety stock.
            </p>

            <form onSubmit={handleCreateProduct} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>
                    SKU Code *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. MED-AZI-500"
                    className="search-input"
                    style={{ width: '100%', fontFamily: 'var(--font-mono)' }}
                    value={newProductData.sku}
                    onChange={(e) => setNewProductData({ ...newProductData, sku: e.target.value })}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>
                    Brand Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Azithral 500"
                    className="search-input"
                    style={{ width: '100%' }}
                    value={newProductData.brand}
                    onChange={(e) => setNewProductData({ ...newProductData, brand: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>
                  Full Product Name & Formulation *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Azithromycin Tablets IP 500mg"
                  className="search-input"
                  style={{ width: '100%' }}
                  value={newProductData.name}
                  onChange={(e) => setNewProductData({ ...newProductData, name: e.target.value })}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>
                    Active Molecule / API *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Azithromycin Dihydrate"
                    className="search-input"
                    style={{ width: '100%' }}
                    value={newProductData.molecule}
                    onChange={(e) => setNewProductData({ ...newProductData, molecule: e.target.value })}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>
                    Therapeutic Category
                  </label>
                  <select
                    className="select-filter"
                    style={{ width: '100%' }}
                    value={newProductData.category}
                    onChange={(e) => setNewProductData({ ...newProductData, category: e.target.value })}
                  >
                    <option value="Antibiotic">Antibiotic</option>
                    <option value="Critical Care Injectable">Critical Care Injectable</option>
                    <option value="Biologic / Vaccine">Biologic / Vaccine</option>
                    <option value="Cardiovascular">Cardiovascular</option>
                    <option value="Analgesic">Analgesic</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>
                    Storage Range
                  </label>
                  <input
                    type="text"
                    className="search-input"
                    style={{ width: '100%' }}
                    value={newProductData.storage_range}
                    onChange={(e) => setNewProductData({ ...newProductData, storage_range: e.target.value })}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>
                    Min Safety Stock (Units)
                  </label>
                  <input
                    type="number"
                    min={10}
                    className="search-input"
                    style={{ width: '100%' }}
                    value={newProductData.min_safety_stock}
                    onChange={(e) => setNewProductData({ ...newProductData, min_safety_stock: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="checkbox"
                  id="chkCritical"
                  checked={newProductData.is_critical}
                  onChange={(e) => setNewProductData({ ...newProductData, is_critical: e.target.checked })}
                />
                <label htmlFor="chkCritical" style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                  Mark as Critical Care Formulation (High Shortage Priority)
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowAddProductModal(false)}
                  disabled={addProductSubmitting}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={addProductSubmitting}>
                  {addProductSubmitting ? 'Adding...' : 'Add to Catalog'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
