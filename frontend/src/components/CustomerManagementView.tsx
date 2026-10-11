import React, { useCallback, useEffect, useState } from 'react'
import type { Customer, Dispatch, CreateCustomerInput, UpdateCustomerInput } from '../types/arogya'
import {
  fetchCustomersList,
  fetchCustomerDetail,
  createCustomer,
  updateCustomer,
} from '../services/api'
import { CustomersIcon } from './Icons'

export function CustomerManagementView() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [total, setTotal] = useState<number>(0)
  const [loading, setLoading] = useState<boolean>(true)
  const [search, setSearch] = useState<string>('')
  const [customerType, setCustomerType] = useState<string>('')
  const [location, setLocation] = useState<string>('')
  const [page, setPage] = useState<number>(1)
  const pageSize = 20

  // Detail Modal state
  const [selectedCode, setSelectedCode] = useState<string | null>(null)
  const [detailLoading, setDetailLoading] = useState<boolean>(false)
  const [customerDetail, setCustomerDetail] = useState<{
    customer: Customer
    dispatches: Dispatch[]
    metrics: Record<string, any>
  } | null>(null)

  // Add Customer Modal
  const [showAddModal, setShowAddModal] = useState<boolean>(false)
  const [submittingAdd, setSubmittingAdd] = useState<boolean>(false)
  const [newCustomer, setNewCustomer] = useState<CreateCustomerInput>({
    code: '',
    name: '',
    customer_type: 'hospital',
    location: 'Bengaluru',
    credit_terms: '30 days',
    priority_tier: 1,
    contact_email: '',
    phone: '',
    address: '',
  })

  // Edit Customer Modal
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  const [editForm, setEditForm] = useState<UpdateCustomerInput>({})
  const [submittingEdit, setSubmittingEdit] = useState<boolean>(false)

  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const loadCustomers = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetchCustomersList({
        search: search.trim() || undefined,
        customer_type: customerType || undefined,
        location: location || undefined,
        page,
        page_size: pageSize,
      })
      setCustomers(res.items || [])
      setTotal(res.total || 0)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [search, customerType, location, page])

  useEffect(() => {
    loadCustomers()
  }, [loadCustomers])

  const openDetail = async (code: string) => {
    setSelectedCode(code)
    setDetailLoading(true)
    try {
      const d = await fetchCustomerDetail(code)
      setCustomerDetail(d)
    } catch {
      setCustomerDetail(null)
    } finally {
      setDetailLoading(false)
    }
  }

  const closeDetail = () => {
    setSelectedCode(null)
    setCustomerDetail(null)
  }

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newCustomer.code.trim() || !newCustomer.name.trim()) {
      alert('Code and Facility Name are required.')
      return
    }

    setSubmittingAdd(true)
    try {
      const created = await createCustomer({
        ...newCustomer,
        code: newCustomer.code.trim().toUpperCase(),
        name: newCustomer.name.trim(),
      })
      setShowAddModal(false)
      setFeedbackMsg({
        type: 'success',
        text: `✓ Customer '${created.name}' (${created.code}) registered successfully!`,
      })
      setNewCustomer({
        code: '',
        name: '',
        customer_type: 'hospital',
        location: 'Bengaluru',
        credit_terms: '30 days',
        priority_tier: 1,
        contact_email: '',
        phone: '',
        address: '',
      })
      loadCustomers()
    } catch (err: unknown) {
      setFeedbackMsg({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to register customer',
      })
    } finally {
      setSubmittingAdd(false)
    }
  }

  const handleOpenEdit = (c: Customer) => {
    setEditingCustomer(c)
    setEditForm({
      name: c.name,
      customer_type: c.customer_type,
      location: c.location || '',
      credit_terms: c.credit_terms || '30 days',
      priority_tier: c.priority_tier || 1,
      contact_email: c.contact_email || '',
      phone: c.phone || '',
      address: c.address || '',
    })
  }

  const handleUpdateCustomer = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingCustomer) return
    setSubmittingEdit(true)
    try {
      const updated = await updateCustomer(editingCustomer.id, editForm)
      setEditingCustomer(null)
      if (selectedCode === editingCustomer.code) {
        openDetail(editingCustomer.code)
      }
      setFeedbackMsg({
        type: 'success',
        text: `✓ Customer '${updated.code}' updated successfully!`,
      })
      loadCustomers()
    } catch (err: unknown) {
      setFeedbackMsg({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to update customer',
      })
    } finally {
      setSubmittingEdit(false)
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
              backgroundColor: 'var(--accent-primary-light)',
              color: 'var(--accent-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid var(--accent-primary-border)',
              boxShadow: '0 2px 6px var(--accent-primary-light)',
              flexShrink: 0,
            }}
          >
            <CustomersIcon size={24} color="var(--accent-primary)" />
          </div>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
              Customer Directory & Account Management
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0.2rem 0 0 0' }}>
              Comprehensive directory of all {total} customer healthcare facilities, pharmacy chains, location geography, and credit terms.
            </p>
          </div>
        </div>

        <button
          className="btn-primary"
          onClick={() => setShowAddModal(true)}
          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem', fontSize: '0.82rem' }}
        >
          <span>+</span> Register New Customer
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
            placeholder="Search by customer name, code, or city..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            style={{ minWidth: 260, flex: '1 1 240px' }}
          />

          <select
            className="select-filter"
            value={customerType}
            onChange={(e) => {
              setCustomerType(e.target.value)
              setPage(1)
            }}
          >
            <option value="">All Customer Types</option>
            <option value="hospital">Hospitals / Inpatient</option>
            <option value="chemist">Retail Chemists / Pharmacies</option>
          </select>

          <input
            type="text"
            className="search-input"
            placeholder="Filter location / city..."
            value={location}
            onChange={(e) => {
              setLocation(e.target.value)
              setPage(1)
            }}
            style={{ width: 180 }}
          />
        </div>

        {/* Table */}
        <div className="table-scroll-container" style={{ overflowX: 'auto', width: '100%' }}>
          {loading ? (
            <div style={{ padding: '3rem 0', textAlign: 'center', color: 'var(--text-muted)' }}>
              Loading customer accounts from database...
            </div>
          ) : customers.length === 0 ? (
            <div style={{ padding: '3rem 0', textAlign: 'center', color: 'var(--text-muted)' }}>
              No customer accounts found matching criteria.
            </div>
          ) : (
            <table className="data-table" style={{ width: '100%', minWidth: 800 }}>
              <thead>
                <tr>
                  <th>Account Code</th>
                  <th>Facility Name</th>
                  <th>Type</th>
                  <th>Geographic Location</th>
                  <th>Credit Terms</th>
                  <th>Priority</th>
                  <th>Contact</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => {
                  const isHospital = c.customer_type?.toLowerCase().includes('hospital')
                  return (
                    <tr key={c.id}>
                      <td>
                        <button
                          onClick={() => openDetail(c.code)}
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
                        >
                          {c.code}
                        </button>
                      </td>
                      <td style={{ fontWeight: 500 }}>{c.name}</td>
                      <td>
                        <span
                          className="badge"
                          style={{
                            backgroundColor: isHospital ? 'var(--accent-primary-light)' : 'var(--bg-tag)',
                            color: isHospital ? 'var(--accent-primary)' : 'var(--text-muted)',
                            border: `1px solid ${isHospital ? 'var(--accent-primary-border)' : 'var(--border-subtle)'}`,
                          }}
                        >
                          {isHospital ? '🏥 Hospital' : '💊 Chemist'}
                        </span>
                      </td>
                      <td>{c.location || '—'}</td>
                      <td>{c.credit_terms || '30 days'}</td>
                      <td>
                        <span style={{ fontWeight: 600, color: c.priority_tier === 1 ? '#dc2626' : 'inherit' }}>
                          Tier {c.priority_tier || 2}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {c.contact_email || c.phone || '—'}
                      </td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button
                          className="btn-secondary"
                          onClick={() => openDetail(c.code)}
                          style={{ padding: '0.25rem 0.65rem', fontSize: '0.75rem', marginRight: '0.4rem' }}
                        >
                          View Details &rarr;
                        </button>
                        <button
                          className="btn-secondary"
                          onClick={() => handleOpenEdit(c)}
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                          title="Edit Customer"
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
            borderTop: '1px solid var(--border-subtle)',
            fontSize: '0.8rem',
            color: 'var(--text-muted)',
            flexWrap: 'wrap',
            gap: '0.5rem',
          }}
        >
          <span>
            Showing {customers.length} of {total} customer accounts
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

      {/* Customer Detail Modal */}
      {selectedCode && (
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
                borderBottom: '1px solid var(--border-subtle)',
                paddingBottom: '0.75rem',
                marginBottom: '1rem',
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--text-main)' }}>
                  {customerDetail?.customer.name}
                </h3>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Account Code: <strong style={{ color: 'var(--accent-primary)' }}>{selectedCode}</strong> &bull; Location: {customerDetail?.customer.location} &bull; Type: {customerDetail?.customer.customer_type}
                </p>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {customerDetail?.customer && (
                  <button
                    className="btn-secondary"
                    onClick={() => handleOpenEdit(customerDetail.customer)}
                    style={{ padding: '0.3rem 0.7rem', fontSize: '0.78rem' }}
                  >
                    ✏️ Edit
                  </button>
                )}
                <button className="btn-secondary" onClick={closeDetail} style={{ padding: '0.3rem 0.6rem' }}>
                  ✕ Close
                </button>
              </div>
            </div>

            {detailLoading ? (
              <div style={{ padding: '2rem 0', textAlign: 'center', color: 'var(--text-muted)' }}>
                Loading customer consignment records...
              </div>
            ) : customerDetail ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {/* Metric Summary */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
                  <div style={{ padding: '0.85rem', borderRadius: 8, background: 'var(--bg-card-subtle)', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total Consignments</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)' }}>
                      {customerDetail.dispatches?.length || 0} shipments
                    </div>
                  </div>

                  <div style={{ padding: '0.85rem', borderRadius: 8, background: 'var(--bg-card-subtle)', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total Units Received</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)' }}>
                      {(customerDetail.dispatches || []).reduce((acc, d) => acc + d.quantity, 0).toLocaleString()} units
                    </div>
                  </div>

                  <div style={{ padding: '0.85rem', borderRadius: 8, background: 'var(--bg-card-subtle)', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Payment Terms</div>
                    <div style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--text-main)' }}>
                      {customerDetail.customer.credit_terms || '30 days net'}
                    </div>
                  </div>
                </div>

                {/* Recent Dispatches */}
                <div>
                  <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: 'var(--text-main)' }}>
                    🚚 Outbound Dispatches & Deliveries
                  </h4>
                  {customerDetail.dispatches.length === 0 ? (
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No recorded dispatches for this customer account.</p>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table className="data-table" style={{ fontSize: '0.8rem', width: '100%' }}>
                        <thead>
                          <tr>
                            <th>Dispatch ID</th>
                            <th>SKU</th>
                            <th>Product Formulation</th>
                            <th>Batch</th>
                            <th>Units</th>
                            <th>Dispatch Date</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {customerDetail.dispatches.slice(0, 15).map((d) => (
                            <tr key={d.id}>
                              <td style={{ fontWeight: 600 }}>{d.dispatch_number}</td>
                              <td>{d.sku}</td>
                              <td>{d.product_name}</td>
                              <td>{d.batch_number}</td>
                              <td>{d.quantity}</td>
                              <td>{d.dispatch_date?.slice(0, 10)}</td>
                              <td>
                                <span className="badge badge-online">
                                  {d.status || 'delivered'}
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

      {/* Add Customer Modal */}
      {showAddModal && (
        <div className="modal-backdrop" onClick={() => setShowAddModal(false)} role="dialog" aria-modal="true">
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 500, width: '100%', padding: '1.5rem' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text-main)' }}>
                🏥 Register New Healthcare Customer
              </h3>
              <button
                className="btn-secondary"
                onClick={() => setShowAddModal(false)}
                style={{ width: 28, height: 28, padding: 0 }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateCustomer} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>
                    Account Code *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. HOSP-BLR-12"
                    value={newCustomer.code}
                    onChange={(e) => setNewCustomer({ ...newCustomer, code: e.target.value })}
                    style={{ width: '100%', padding: '0.45rem', borderRadius: 6, border: '1px solid var(--border-subtle)' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>
                    Facility Type
                  </label>
                  <select
                    value={newCustomer.customer_type}
                    onChange={(e) => setNewCustomer({ ...newCustomer, customer_type: e.target.value })}
                    style={{ width: '100%', padding: '0.45rem', borderRadius: 6, border: '1px solid var(--border-subtle)' }}
                  >
                    <option value="hospital">Hospital / Acute Inpatient</option>
                    <option value="chemist">Retail Chemist / Pharmacy</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>
                  Facility / Organization Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Manipal Hospital Old Airport Rd"
                  value={newCustomer.name}
                  onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                  style={{ width: '100%', padding: '0.45rem', borderRadius: 6, border: '1px solid var(--border-subtle)' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>
                    City / Location
                  </label>
                  <input
                    type="text"
                    value={newCustomer.location || ''}
                    onChange={(e) => setNewCustomer({ ...newCustomer, location: e.target.value })}
                    style={{ width: '100%', padding: '0.45rem', borderRadius: 6, border: '1px solid var(--border-subtle)' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>
                    Credit Terms
                  </label>
                  <input
                    type="text"
                    value={newCustomer.credit_terms || '30 days'}
                    onChange={(e) => setNewCustomer({ ...newCustomer, credit_terms: e.target.value })}
                    style={{ width: '100%', padding: '0.45rem', borderRadius: 6, border: '1px solid var(--border-subtle)' }}
                  />
                </div>
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
                  {submittingAdd ? 'Saving...' : 'Register Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Customer Modal */}
      {editingCustomer && (
        <div className="modal-backdrop" onClick={() => setEditingCustomer(null)} role="dialog" aria-modal="true">
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 500, width: '100%', padding: '1.5rem' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text-main)' }}>
                ✏️ Edit Customer ({editingCustomer.code})
              </h3>
              <button
                className="btn-secondary"
                onClick={() => setEditingCustomer(null)}
                style={{ width: 28, height: 28, padding: 0 }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateCustomer} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>
                  Facility Name
                </label>
                <input
                  type="text"
                  value={editForm.name || ''}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  style={{ width: '100%', padding: '0.45rem', borderRadius: 6, border: '1px solid var(--border-subtle)' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>
                    Location
                  </label>
                  <input
                    type="text"
                    value={editForm.location || ''}
                    onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                    style={{ width: '100%', padding: '0.45rem', borderRadius: 6, border: '1px solid var(--border-subtle)' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>
                    Credit Terms
                  </label>
                  <input
                    type="text"
                    value={editForm.credit_terms || ''}
                    onChange={(e) => setEditForm({ ...editForm, credit_terms: e.target.value })}
                    style={{ width: '100%', padding: '0.45rem', borderRadius: 6, border: '1px solid var(--border-subtle)' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setEditingCustomer(null)}
                  disabled={submittingEdit}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={submittingEdit}
                >
                  {submittingEdit ? 'Saving...' : 'Update Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
