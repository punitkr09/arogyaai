import React, { useCallback, useEffect, useState } from 'react'
import type { Product, BatchSummary, Supplier, PurchaseOrder, Dispatch, CreateProductInput, UpdateProductInput } from '../types/arogya'
import {
  fetchProductsCatalogue,
  fetchProductDetail,
  createProduct,
  updateProduct,
  deleteProduct,
} from '../services/api'
import { ProductsIcon, SearchIcon, CloseIcon } from './Icons'

interface ProductCatalogueViewProps {
  onInvestigateProduct?: (sku: string) => void
}

export function ProductCatalogueView({ onInvestigateProduct }: ProductCatalogueViewProps) {
  const [products, setProducts] = useState<Product[]>([])
  const [total, setTotal] = useState<number>(0)
  const [loading, setLoading] = useState<boolean>(true)
  const [search, setSearch] = useState<string>('')
  const [category, setCategory] = useState<string>('')
  const [storage, setStorage] = useState<string>('')
  const [criticalOnly, setCriticalOnly] = useState<boolean>(false)
  const [page, setPage] = useState<number>(1)
  const pageSize = 20

  // Detail Modal state
  const [selectedSku, setSelectedSku] = useState<string | null>(null)
  const [detailLoading, setDetailLoading] = useState<boolean>(false)
  const [productDetail, setProductDetail] = useState<{
    product: Product
    batches: BatchSummary[]
    suppliers: Supplier[]
    purchase_orders: PurchaseOrder[]
    recent_dispatches: Dispatch[]
    metrics: Record<string, any>
  } | null>(null)

  // Add Product Modal state
  const [showAddModal, setShowAddModal] = useState<boolean>(false)
  const [submittingAdd, setSubmittingAdd] = useState<boolean>(false)
  const [newProduct, setNewProduct] = useState<CreateProductInput>({
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

  // Edit Product Modal state
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [editForm, setEditForm] = useState<UpdateProductInput>({})
  const [submittingEdit, setSubmittingEdit] = useState<boolean>(false)

  // Delete Confirmation state
  const [productToDelete, setProductToDelete] = useState<Product | null>(null)
  const [deleting, setDeleting] = useState<boolean>(false)

  // Feedback notifications
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const loadProducts = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetchProductsCatalogue({
        search: search.trim() || undefined,
        category: category || undefined,
        storage: storage || undefined,
        is_critical: criticalOnly ? true : undefined,
        page,
        page_size: pageSize,
      })
      setProducts(res.items || [])
      setTotal(res.total || 0)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [search, category, storage, criticalOnly, page])

  useEffect(() => {
    loadProducts()
  }, [loadProducts])

  const openDetail = async (sku: string) => {
    setSelectedSku(sku)
    setDetailLoading(true)
    try {
      const d = await fetchProductDetail(sku)
      setProductDetail(d)
    } catch {
      setProductDetail(null)
    } finally {
      setDetailLoading(false)
    }
  }

  const closeDetail = () => {
    setSelectedSku(null)
    setProductDetail(null)
  }

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newProduct.sku.trim() || !newProduct.name.trim()) {
      alert('SKU and Product Name are required.')
      return
    }

    setSubmittingAdd(true)
    try {
      const created = await createProduct({
        ...newProduct,
        sku: newProduct.sku.trim().toUpperCase(),
        name: newProduct.name.trim(),
        molecule: newProduct.molecule.trim(),
        brand: newProduct.brand.trim() || newProduct.name.trim(),
      })
      setShowAddModal(false)
      setFeedbackMsg({
        type: 'success',
        text: `✓ Product '${created.name}' (${created.sku}) added to Master Formulary!`,
      })
      setNewProduct({
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
      loadProducts()
    } catch (err: unknown) {
      setFeedbackMsg({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to create product',
      })
    } finally {
      setSubmittingAdd(false)
    }
  }

  const handleOpenEdit = (p: Product) => {
    setEditingProduct(p)
    setEditForm({
      name: p.name,
      molecule: p.molecule,
      brand: p.brand,
      category: p.category,
      storage_range: p.storage_range,
      is_critical: p.is_critical,
      unit_price: p.unit_price,
      min_safety_stock: p.min_safety_stock,
    })
  }

  const handleUpdateProduct = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingProduct) return
    setSubmittingEdit(true)
    try {
      const updated = await updateProduct(editingProduct.id, editForm)
      setEditingProduct(null)
      if (selectedSku === editingProduct.sku) {
        openDetail(editingProduct.sku)
      }
      setFeedbackMsg({
        type: 'success',
        text: `✓ Product '${updated.sku}' updated successfully!`,
      })
      loadProducts()
    } catch (err: unknown) {
      setFeedbackMsg({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to update product',
      })
    } finally {
      setSubmittingEdit(false)
    }
  }

  const handleDeleteProduct = async () => {
    if (!productToDelete) return
    setDeleting(true)
    try {
      await deleteProduct(productToDelete.id)
      setProductToDelete(null)
      if (selectedSku === productToDelete.sku) {
        closeDetail()
      }
      setFeedbackMsg({
        type: 'success',
        text: `✓ Product '${productToDelete.sku}' deleted from Master Formulary.`,
      })
      loadProducts()
    } catch (err: unknown) {
      setFeedbackMsg({
        type: 'error',
        text: err instanceof Error ? err.message : 'Cannot delete product',
      })
      setProductToDelete(null)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div>
      {/* Header Banner matching reference image */}
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
              backgroundColor: 'rgba(56, 189, 248, 0.12)',
              color: 'var(--accent-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              boxShadow: '0 0 12px var(--accent-primary-light)',
              flexShrink: 0,
            }}
          >
            <ProductsIcon size={24} color="var(--accent-primary)" />
          </div>
          <div>
            <h2
              style={{
                fontSize: '1.25rem',
                fontWeight: 700,
                color: 'var(--text-main)',
                margin: 0,
                lineHeight: 1.2,
              }}
            >
              Master Product Catalogue
            </h2>
            <p
              style={{
                fontSize: '0.8rem',
                color: 'var(--text-muted)',
                margin: '0.2rem 0 0 0',
              }}
            >
              Comprehensive pharmaceutical formulary with storage limits, critical care ratings, and batch linkages. Total {total} products loaded from database.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button
            className="btn-primary"
            onClick={() => setShowAddModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.5rem 1rem',
              fontSize: '0.82rem',
              fontWeight: 600,
            }}
          >
            <span>+</span> Add New Product
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
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'inherit', display: 'flex', alignItems: 'center' }}
            aria-label="Dismiss feedback"
          >
            <CloseIcon size={14} />
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
            alignItems: 'center',
            padding: '0.85rem 1rem',
            borderBottom: '1px solid var(--border-subtle)',
            backgroundColor: 'var(--bg-surface)',
          }}
        >
          <div style={{ position: 'relative', flex: '1 1 260px' }}>
            <span
              style={{
                position: 'absolute',
                left: '0.75rem',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-dim)',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <SearchIcon size={14} />
            </span>
            <input
              type="text"
              className="search-input"
              placeholder="Search SKU, molecule, or brand name..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              style={{
                width: '100%',
                paddingLeft: '2.2rem',
                borderRadius: 6,
                border: '1px solid var(--border-subtle, #e5dfd5)',
                fontSize: '0.85rem',
                paddingTop: '0.45rem',
                paddingBottom: '0.45rem',
              }}
            />
          </div>

          <select
            className="select-filter"
            value={category}
            onChange={(e) => {
              setCategory(e.target.value)
              setPage(1)
            }}
            style={{
              padding: '0.45rem 0.85rem',
              borderRadius: 6,
              border: '1px solid var(--border-subtle)',
              fontSize: '0.85rem',
              backgroundColor: 'var(--bg-input)',
              color: 'var(--text-main)',
            }}
          >
            <option value="">All Categories</option>
            <option value="Antibiotic">Antibiotic</option>
            <option value="Anticoagulant">Anticoagulant</option>
            <option value="Antidiabetic">Antidiabetic</option>
            <option value="Antiallergic">Antiallergic</option>
            <option value="Cardiac">Cardiac</option>
            <option value="Cardiovascular">Cardiovascular</option>
            <option value="Critical Care">Critical Care</option>
            <option value="Gastro">Gastro</option>
            <option value="Respiratory">Respiratory</option>
            <option value="Vaccine">Vaccine</option>
            <option value="Thyroid">Thyroid</option>
          </select>

          <select
            className="select-filter"
            value={storage}
            onChange={(e) => {
              setStorage(e.target.value)
              setPage(1)
            }}
            style={{
              padding: '0.45rem 0.85rem',
              borderRadius: 6,
              border: '1px solid var(--border-subtle)',
              fontSize: '0.85rem',
              backgroundColor: 'var(--bg-input)',
              color: 'var(--text-main)',
            }}
          >
            <option value="">All Storage Conditions</option>
            <option value="2°C">Cold Chain (2°C - 8°C)</option>
            <option value="15°C">Controlled Room Temp (15°C - 25°C)</option>
          </select>

          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              fontSize: '0.82rem',
              color: 'var(--text-main, #1e242b)',
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            <input
              type="checkbox"
              checked={criticalOnly}
              onChange={(e) => {
                setCriticalOnly(e.target.checked)
                setPage(1)
              }}
            />
            Critical Drugs Only
          </label>
        </div>

        {/* Table Container with responsive scroll */}
        <div className="table-scroll-container" style={{ overflowX: 'auto', width: '100%' }}>
          {loading ? (
            <div style={{ padding: '3rem 0', textAlign: 'center', color: 'var(--text-muted)' }}>
              Loading pharmaceutical catalogue records...
            </div>
          ) : products.length === 0 ? (
            <div style={{ padding: '3rem 0', textAlign: 'center', color: 'var(--text-muted)' }}>
              No products match the selected criteria.
            </div>
          ) : (
            <table className="data-table" style={{ width: '100%', minWidth: 800 }}>
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Brand / Trade Name</th>
                  <th>Active Molecule</th>
                  <th>Category</th>
                  <th>Storage Specs</th>
                  <th>Critical</th>
                  <th>Unit Price</th>
                  <th>Safety Buffer</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => {
                  const isCold = p.storage_range?.includes('2') || p.storage_range?.toLowerCase().includes('cold')
                  return (
                    <tr key={p.id}>
                      <td>
                        <button
                          onClick={() => openDetail(p.sku)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--accent-primary)',
                            fontWeight: 600,
                            cursor: 'pointer',
                            fontSize: '0.85rem',
                            textAlign: 'left',
                            padding: 0,
                          }}
                          title={`Click to view ${p.sku} details`}
                        >
                          {p.sku}
                        </button>
                      </td>
                      <td style={{ fontWeight: 500 }}>{p.brand || p.name}</td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{p.molecule}</td>
                      <td>
                        <strong style={{ fontSize: '0.82rem', color: 'var(--text-main)' }}>
                          {p.category}
                        </strong>
                      </td>
                      <td>
                        <span
                          style={{
                            fontSize: '0.78rem',
                            color: isCold ? '#0284c7' : 'inherit',
                            fontWeight: isCold ? 600 : 'normal',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                          }}
                        >
                          {isCold ? '❄️' : '🌡️'} {p.storage_range || '15°C - 25°C'}
                        </span>
                      </td>
                      <td>
                        {p.is_critical ? (
                          <span
                            className="badge"
                            style={{
                              backgroundColor: '#dc2626',
                              color: '#fff',
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              letterSpacing: '0.04em',
                            }}
                          >
                            CRITICAL
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Standard</span>
                        )}
                      </td>
                      <td style={{ fontWeight: 500 }}>₹{p.unit_price ? p.unit_price.toFixed(2) : '0.00'}</td>
                      <td>{p.min_safety_stock || 100} units</td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button
                          className="btn-secondary"
                          onClick={() => openDetail(p.sku)}
                          style={{ padding: '0.25rem 0.65rem', fontSize: '0.75rem', marginRight: '0.4rem' }}
                        >
                          View Details &rarr;
                        </button>
                        <button
                          className="btn-secondary"
                          onClick={() => handleOpenEdit(p)}
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                          title="Edit Product"
                        >
                          ✏️
                        </button>
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
            borderTop: '1px solid var(--border-subtle, #e5dfd5)',
            fontSize: '0.8rem',
            color: 'var(--text-muted, #56616d)',
            flexWrap: 'wrap',
            gap: '0.5rem',
          }}
        >
          <span>
            Showing {products.length} of {total} products (Page {page} of {Math.ceil(total / pageSize) || 1})
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

      {/* Product Detail Modal */}
      {selectedSku && (
        <div className="modal-backdrop" onClick={closeDetail} role="dialog" aria-modal="true">
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 860, maxHeight: '90vh', overflowY: 'auto', padding: '1.5rem' }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                borderBottom: '1px solid var(--border-subtle, #e5dfd5)',
                paddingBottom: '0.75rem',
                marginBottom: '1rem',
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--text-main, #1e242b)' }}>
                  {productDetail?.product.brand || productDetail?.product.name}
                </h3>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  SKU: <strong style={{ color: 'var(--accent-primary)' }}>{selectedSku}</strong> &bull; Molecule: {productDetail?.product.molecule} &bull; Category: {productDetail?.product.category}
                </p>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {productDetail?.product && (
                  <>
                    <button
                      className="btn-secondary"
                      onClick={() => handleOpenEdit(productDetail.product)}
                      style={{ padding: '0.3rem 0.7rem', fontSize: '0.78rem' }}
                    >
                      ✏️ Edit
                    </button>
                    <button
                      className="btn-secondary"
                      onClick={() => setProductToDelete(productDetail.product)}
                      style={{ padding: '0.3rem 0.7rem', fontSize: '0.78rem', color: '#dc2626' }}
                    >
                      🗑️ Delete
                    </button>
                  </>
                )}
                <button className="btn-secondary" onClick={closeDetail} style={{ padding: '0.3rem 0.6rem' }}>
                  ✕ Close
                </button>
              </div>
            </div>

            {detailLoading ? (
              <div style={{ padding: '2rem 0', textAlign: 'center', color: 'var(--text-muted)' }}>
                Loading product inventory, suppliers, and dispatch history...
              </div>
            ) : productDetail ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {/* Metric Summary Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
                  <div style={{ padding: '0.85rem', borderRadius: 8, background: 'var(--bg-card-subtle)', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Available Stock</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)' }}>
                      {productDetail.metrics?.total_available_stock || 0} units
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Across {productDetail.batches.length} batches</div>
                  </div>

                  <div style={{ padding: '0.85rem', borderRadius: 8, background: 'var(--bg-card-subtle)', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Historical Dispatches</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)' }}>
                      {productDetail.metrics?.total_dispatched_units || 0} units
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{productDetail.metrics?.total_dispatches_count || 0} total shipments</div>
                  </div>

                  <div style={{ padding: '0.85rem', borderRadius: 8, background: 'var(--bg-card-subtle)', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Minimum Safety Stock</div>
                    <div
                      style={{
                        fontSize: '1.25rem',
                        fontWeight: 700,
                        color: (productDetail.metrics?.total_available_stock || 0) < productDetail.product.min_safety_stock ? '#dc2626' : '#16a34a',
                      }}
                    >
                      {productDetail.product.min_safety_stock} units
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      {(productDetail.metrics?.total_available_stock || 0) < productDetail.product.min_safety_stock ? '⚠️ Stock deficit!' : '✓ Safe reserve'}
                    </div>
                  </div>
                </div>

                {/* Related Batches */}
                <div>
                  <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: 'var(--text-main)' }}>
                    📦 Physical Inventory Batches ({productDetail.batches.length})
                  </h4>
                  {productDetail.batches.length === 0 ? (
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No inventory batches currently in warehouse stock.</p>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table className="data-table" style={{ fontSize: '0.8rem', width: '100%' }}>
                        <thead>
                          <tr>
                            <th>Batch Number</th>
                            <th>Warehouse</th>
                            <th>Available Units</th>
                            <th>Expiry Date</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {productDetail.batches.map((b) => (
                            <tr key={b.id}>
                              <td style={{ fontWeight: 600 }}>{b.batch_number}</td>
                              <td>{b.warehouse_name || b.warehouse_code}</td>
                              <td>{b.available_quantity}</td>
                              <td>{b.expiry_date?.slice(0, 10)}</td>
                              <td>
                                <span className={`badge ${b.status === 'active' ? 'badge-online' : 'badge-offline'}`}>
                                  {b.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Associated Suppliers */}
                {productDetail.suppliers && productDetail.suppliers.length > 0 && (
                  <div>
                    <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: 'var(--text-main)' }}>
                      🏭 Associated Suppliers ({productDetail.suppliers.length})
                    </h4>
                    <div style={{ overflowX: 'auto' }}>
                      <table className="data-table" style={{ fontSize: '0.8rem', width: '100%' }}>
                        <thead>
                          <tr>
                            <th>Manufacturer</th>
                            <th>Lead Time</th>
                            <th>Min Order Quantity</th>
                            <th>Return Policy Window</th>
                          </tr>
                        </thead>
                        <tbody>
                          {productDetail.suppliers.map((s) => (
                            <tr key={s.id}>
                              <td style={{ fontWeight: 600 }}>{s.name}</td>
                              <td>{s.lead_time_days} days</td>
                              <td>{s.min_order_quantity} units</td>
                              <td>{s.return_window_days} days before expiry</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Quick AI Action */}
                {onInvestigateProduct && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '0.5rem' }}>
                    <button
                      className="btn-primary"
                      onClick={() => {
                        closeDetail()
                        onInvestigateProduct(selectedSku)
                      }}
                      style={{ fontSize: '0.82rem', padding: '0.5rem 1rem' }}
                    >
                      🤖 Run AI Operational Investigation on {selectedSku} &rarr;
                    </button>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Add Product Modal */}
      {showAddModal && (
        <div className="modal-backdrop" onClick={() => setShowAddModal(false)} role="dialog" aria-modal="true">
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 520, width: '100%', padding: '1.5rem' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text-main)' }}>
                ➕ Add New Pharmaceutical Product
              </h3>
              <button
                className="btn-secondary"
                onClick={() => setShowAddModal(false)}
                style={{ width: 28, height: 28, padding: 0 }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateProduct} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>
                    SKU Code *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. PH-099"
                    value={newProduct.sku}
                    onChange={(e) => setNewProduct({ ...newProduct, sku: e.target.value })}
                    style={{ width: '100%', padding: '0.45rem', borderRadius: 6, border: '1px solid var(--border-subtle)' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>
                    Trade / Brand Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Augmentin 625"
                    value={newProduct.brand}
                    onChange={(e) => setNewProduct({ ...newProduct, brand: e.target.value, name: e.target.value })}
                    style={{ width: '100%', padding: '0.45rem', borderRadius: 6, border: '1px solid var(--border-subtle)' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>
                  Active Molecule / Formulation *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Amoxicillin + Clavulanic Acid"
                  value={newProduct.molecule}
                  onChange={(e) => setNewProduct({ ...newProduct, molecule: e.target.value })}
                  style={{ width: '100%', padding: '0.45rem', borderRadius: 6, border: '1px solid var(--border-subtle)' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>
                    Therapeutic Category
                  </label>
                  <select
                    value={newProduct.category}
                    onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })}
                    style={{ width: '100%', padding: '0.45rem', borderRadius: 6, border: '1px solid var(--border-subtle)' }}
                  >
                    <option value="Antibiotic">Antibiotic</option>
                    <option value="Anticoagulant">Anticoagulant</option>
                    <option value="Antidiabetic">Antidiabetic</option>
                    <option value="Antiallergic">Antiallergic</option>
                    <option value="Cardiac">Cardiac</option>
                    <option value="Cardiovascular">Cardiovascular</option>
                    <option value="Critical Care">Critical Care</option>
                    <option value="Gastro">Gastro</option>
                    <option value="Respiratory">Respiratory</option>
                    <option value="Vaccine">Vaccine</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>
                    Storage Specs
                  </label>
                  <select
                    value={newProduct.storage_range}
                    onChange={(e) => setNewProduct({ ...newProduct, storage_range: e.target.value })}
                    style={{ width: '100%', padding: '0.45rem', borderRadius: 6, border: '1px solid var(--border-subtle)' }}
                  >
                    <option value="15°C - 25°C">Controlled Room Temp (15°C - 25°C)</option>
                    <option value="2°C - 8°C">Cold Chain (2°C - 8°C)</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>
                    Unit Price (₹)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={newProduct.unit_price}
                    onChange={(e) => setNewProduct({ ...newProduct, unit_price: Number(e.target.value) })}
                    style={{ width: '100%', padding: '0.45rem', borderRadius: 6, border: '1px solid var(--border-subtle)' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>
                    Safety Buffer Units
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={newProduct.min_safety_stock}
                    onChange={(e) => setNewProduct({ ...newProduct, min_safety_stock: Number(e.target.value) })}
                    style={{ width: '100%', padding: '0.45rem', borderRadius: 6, border: '1px solid var(--border-subtle)' }}
                  />
                </div>
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={newProduct.is_critical}
                  onChange={(e) => setNewProduct({ ...newProduct, is_critical: e.target.checked })}
                />
                Mark as Critical Care Medicine (Escalated Shortage Monitoring)
              </label>

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
                  {submittingAdd ? 'Saving to Database...' : 'Save Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Product Modal */}
      {editingProduct && (
        <div className="modal-backdrop" onClick={() => setEditingProduct(null)} role="dialog" aria-modal="true">
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 500, width: '100%', padding: '1.5rem' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text-main)' }}>
                ✏️ Edit Product ({editingProduct.sku})
              </h3>
              <button
                className="btn-secondary"
                onClick={() => setEditingProduct(null)}
                style={{ width: 28, height: 28, padding: 0 }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateProduct} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>
                  Brand / Trade Name
                </label>
                <input
                  type="text"
                  value={editForm.brand || ''}
                  onChange={(e) => setEditForm({ ...editForm, brand: e.target.value, name: e.target.value })}
                  style={{ width: '100%', padding: '0.45rem', borderRadius: 6, border: '1px solid var(--border-subtle)' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>
                  Active Molecule
                </label>
                <input
                  type="text"
                  value={editForm.molecule || ''}
                  onChange={(e) => setEditForm({ ...editForm, molecule: e.target.value })}
                  style={{ width: '100%', padding: '0.45rem', borderRadius: 6, border: '1px solid var(--border-subtle)' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>
                    Unit Price (₹)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={editForm.unit_price || 0}
                    onChange={(e) => setEditForm({ ...editForm, unit_price: Number(e.target.value) })}
                    style={{ width: '100%', padding: '0.45rem', borderRadius: 6, border: '1px solid var(--border-subtle)' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>
                    Safety Buffer Stock
                  </label>
                  <input
                    type="number"
                    value={editForm.min_safety_stock || 0}
                    onChange={(e) => setEditForm({ ...editForm, min_safety_stock: Number(e.target.value) })}
                    style={{ width: '100%', padding: '0.45rem', borderRadius: 6, border: '1px solid var(--border-subtle)' }}
                  />
                </div>
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={editForm.is_critical || false}
                  onChange={(e) => setEditForm({ ...editForm, is_critical: e.target.checked })}
                />
                Critical Care Drug
              </label>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setEditingProduct(null)}
                  disabled={submittingEdit}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={submittingEdit}
                >
                  {submittingEdit ? 'Saving...' : 'Update Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {productToDelete && (
        <div className="modal-backdrop" onClick={() => setProductToDelete(null)} role="dialog" aria-modal="true">
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 440, width: '100%', padding: '1.5rem' }}
          >
            <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem', color: '#dc2626' }}>
              ⚠️ Confirm Product Deletion
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-main)', lineHeight: 1.5, margin: '0 0 1.25rem 0' }}>
              Are you sure you want to delete product <strong>{productToDelete.name}</strong> ({productToDelete.sku})?
              <br />
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                This action is permanent. Deletion will be rejected if active inventory batches are currently stored in warehouses.
              </span>
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button
                className="btn-secondary"
                onClick={() => setProductToDelete(null)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={handleDeleteProduct}
                disabled={deleting}
                style={{ backgroundColor: '#dc2626', borderColor: '#b91c1c' }}
              >
                {deleting ? 'Deleting...' : 'Delete Product'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
