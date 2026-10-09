import { useCallback, useEffect, useState } from 'react'
import type { BatchSummary, BatchDetail } from '../types/arogya'
import { fetchBatches, fetchBatchDetails } from '../services/api'

interface BatchExplorerProps {
  onInvestigateBatch?: (batchNumber: string) => void
}

export function BatchExplorer({ onInvestigateBatch }: BatchExplorerProps) {
  const [batches, setBatches] = useState<BatchSummary[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [search, setSearch] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [warehouseFilter, setWarehouseFilter] = useState<string>('')

  // Detail Modal state
  const [selectedBatchNumber, setSelectedBatchNumber] = useState<string | null>(null)
  const [detail, setDetail] = useState<BatchDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState<boolean>(false)

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

  const handleCloseModal = () => {
    setSelectedBatchNumber(null)
    setDetail(null)
  }

  return (
    <div>
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
                    <button
                      className="btn-secondary"
                      onClick={() => handleOpenDetail(b.batch_number)}
                      style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}
                    >
                      Inspect Ledger &rarr;
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Batch Detail Modal / Drawer */}
      {selectedBatchNumber && (
        <div className="modal-overlay" onClick={handleCloseModal}>
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
                onClick={handleCloseModal}
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
                {/* Summary Strip */}
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

                  <div style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid var(--border-subtle)', borderRadius: 6 }}>
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
                        handleCloseModal()
                        onInvestigateBatch(selectedBatchNumber)
                      }}
                    >
                      Investigate with Agent &rarr;
                    </button>
                  )}
                  <button className="btn-secondary" onClick={handleCloseModal}>
                    Close
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  )
}
