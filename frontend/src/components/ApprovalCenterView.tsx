import { useCallback, useEffect, useState } from 'react'
import type { ActionProposal, CreateCustomProposalInput, UpdateProposalInput } from '../types/arogya'
import { fetchProposals, actOnProposal, createCustomProposal, updateProposal } from '../services/api'

interface ApprovalCenterViewProps {
  onApprovalSuccess?: () => void
}

export function ApprovalCenterView({ onApprovalSuccess }: ApprovalCenterViewProps) {
  const [proposals, setProposals] = useState<ActionProposal[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [statusFilter, setStatusFilter] = useState<string>('pending_review')

  // Action Modal State (Authorize / Reject)
  const [activeModalProposal, setActiveModalProposal] = useState<ActionProposal | null>(null)
  const [actionType, setActionType] = useState<'approved' | 'rejected'>('approved')
  const [approverRole, setApproverRole] = useState<string>('Lead Pharmacist (R.Ph)')
  const [approverName, setApproverName] = useState<string>('Dr. Ananya Sharma, R.Ph')
  const [notes, setNotes] = useState<string>('Reviewed trace records and verified 25 recipient coverage.')
  const [submitting, setSubmitting] = useState<boolean>(false)
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null)

  // Create Custom Proposal Modal State
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false)
  const [newProposalData, setNewProposalData] = useState<CreateCustomProposalInput>({
    action_type: 'quarantine_order',
    title: '',
    description: '',
    rationale: '',
    target_entity: '',
    expected_impact: '',
  })
  const [submittingCreate, setSubmittingCreate] = useState<boolean>(false)

  // Edit Proposal Modal State
  const [editingProposal, setEditingProposal] = useState<ActionProposal | null>(null)
  const [editProposalData, setEditProposalData] = useState<UpdateProposalInput>({})
  const [submittingEdit, setSubmittingEdit] = useState<boolean>(false)

  const loadProposals = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchProposals(statusFilter || undefined)
      setProposals(data)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    loadProposals()
  }, [loadProposals])

  const handleOpenActionModal = (p: ActionProposal, decision: 'approved' | 'rejected') => {
    setActiveModalProposal(p)
    setActionType(decision)
    if (decision === 'approved') {
      setNotes(`Approved operational containment. Verified audit trail and compliance invariants.`)
    } else {
      setNotes(`Rejected: Requires additional QA testing documentation.`)
    }
  }

  const handleConfirmDecision = async () => {
    if (!activeModalProposal) return
    setSubmitting(true)
    try {
      await actOnProposal(
        activeModalProposal.id,
        actionType,
        approverRole,
        approverName,
        notes
      )
      setFeedbackMsg(
        actionType === 'approved'
          ? `✓ Proposal #${activeModalProposal.id} successfully APPROVED. Consequential actions recorded in ledger!`
          : `Proposal #${activeModalProposal.id} marked REJECTED.`
      )
      setActiveModalProposal(null)
      await loadProposals()
      if (onApprovalSuccess) {
        onApprovalSuccess()
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Action failed')
    } finally {
      setSubmitting(false)
    }
  }

  const handleCreateProposal = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmittingCreate(true)
    setFeedbackMsg(null)
    try {
      const created = await createCustomProposal(newProposalData)
      setShowCreateModal(false)
      setFeedbackMsg(`✓ Proposal #${created.id} staged at approval gate for review!`)
      setNewProposalData({
        action_type: 'quarantine_order',
        title: '',
        description: '',
        rationale: '',
        target_entity: '',
        expected_impact: '',
      })
      loadProposals()
      if (onApprovalSuccess) onApprovalSuccess()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to create proposal')
    } finally {
      setSubmittingCreate(false)
    }
  }

  const handleOpenEditProposal = (p: ActionProposal) => {
    setEditingProposal(p)
    setEditProposalData({
      title: p.title,
      description: p.description,
      rationale: p.rationale,
      expected_impact: p.expected_impact,
    })
  }

  const handleUpdateProposal = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingProposal) return
    setSubmittingEdit(true)
    try {
      const updated = await updateProposal(editingProposal.id, editProposalData)
      setEditingProposal(null)
      setFeedbackMsg(`✓ Proposal #${updated.id} updated!`)
      loadProposals()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to update proposal')
    } finally {
      setSubmittingEdit(false)
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.2rem' }}>
            Operations & Compliance Approval Center
          </h2>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            Human-in-the-Loop Governance: Consequential operational actions (dispatch freeze, PO submission, quarantine) require authorized sign-off.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button
            className="btn-primary"
            onClick={() => setShowCreateModal(true)}
            style={{ fontSize: '0.82rem', padding: '0.4rem 0.95rem' }}
          >
            + Create Action Proposal
          </button>

          <div style={{ display: 'flex', gap: '0.35rem' }}>
            <button
              className={`tab-btn ${statusFilter === 'pending_review' ? 'active' : ''}`}
              onClick={() => setStatusFilter('pending_review')}
              style={{ padding: '0.35rem 0.85rem', fontSize: '0.82rem' }}
            >
              Pending Review
            </button>
            <button
              className={`tab-btn ${statusFilter === 'approved' ? 'active' : ''}`}
              onClick={() => setStatusFilter('approved')}
              style={{ padding: '0.35rem 0.85rem', fontSize: '0.82rem' }}
            >
              Approved
            </button>
            <button
              className={`tab-btn ${statusFilter === 'rejected' ? 'active' : ''}`}
              onClick={() => setStatusFilter('rejected')}
              style={{ padding: '0.35rem 0.85rem', fontSize: '0.82rem' }}
            >
              Rejected
            </button>
            <button
              className={`tab-btn ${statusFilter === '' ? 'active' : ''}`}
              onClick={() => setStatusFilter('')}
              style={{ padding: '0.35rem 0.85rem', fontSize: '0.82rem' }}
            >
              All
            </button>
          </div>
        </div>
      </div>

      {feedbackMsg && (
        <div
          style={{
            padding: '0.85rem 1rem',
            backgroundColor: 'var(--status-success-bg)',
            color: 'var(--status-success-text)',
            borderRadius: 6,
            border: '1px solid var(--status-success-border)',
            fontSize: '0.85rem',
            fontWeight: 600,
            marginBottom: '1.25rem',
          }}
        >
          {feedbackMsg}
        </div>
      )}

      {loading ? (
        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          Loading action proposals from database...
        </div>
      ) : proposals.length === 0 ? (
        <div
          style={{
            padding: '3rem',
            textAlign: 'center',
            background: 'var(--bg-surface)',
            borderRadius: 8,
            border: '1px solid var(--border-subtle)',
            color: 'var(--text-muted)',
          }}
        >
          No proposals found for status filter: <strong>{statusFilter || 'All'}</strong>.
        </div>
      ) : (
        <div className="proposals-grid">
          {proposals.map((p) => (
            <div
              key={p.id}
              className={`proposal-card ${
                p.status === 'pending_review' ? 'pending' : p.status === 'approved' ? 'approved' : 'rejected'
              }`}
            >
              <div>
                <div className="prop-badge-row">
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      backgroundColor: 'var(--bg-tag)',
                      padding: '0.15rem 0.45rem',
                      borderRadius: 4,
                      color: 'var(--accent-terracotta)',
                    }}
                  >
                    #{p.id} &bull; {p.action_type.toUpperCase()}
                  </span>

                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      padding: '0.15rem 0.5rem',
                      borderRadius: 4,
                      backgroundColor:
                        p.status === 'pending_review'
                          ? 'var(--status-warning-bg)'
                          : p.status === 'approved'
                          ? 'var(--status-success-bg)'
                          : 'var(--status-critical-bg)',
                      color:
                        p.status === 'pending_review'
                          ? 'var(--status-warning-text)'
                          : p.status === 'approved'
                          ? 'var(--status-success-text)'
                          : 'var(--status-critical-text)',
                      border: '1px solid currentColor',
                    }}
                  >
                    {p.status === 'pending_review' ? 'PENDING REVIEW' : p.status.toUpperCase()}
                  </span>
                </div>

                <h3 className="prop-title">{p.title}</h3>
                <p className="prop-body">{p.description}</p>

                <div className="prop-meta">
                  <div style={{ marginBottom: '0.35rem' }}>
                    <strong style={{ color: 'var(--text-main)' }}>Rationale:</strong>{' '}
                    <span style={{ color: 'var(--text-muted)' }}>{p.rationale}</span>
                  </div>
                  <div style={{ marginBottom: '0.35rem' }}>
                    <strong style={{ color: 'var(--text-main)' }}>Target Entity:</strong>{' '}
                    <span style={{ color: 'var(--text-muted)' }}>{p.target_entity}</span>
                  </div>
                  <div>
                    <strong style={{ color: 'var(--text-main)' }}>Expected Impact:</strong>{' '}
                    <span style={{ color: 'var(--text-muted)' }}>{p.expected_impact}</span>
                  </div>

                  {p.approved_by && (
                    <div style={{ marginTop: '0.5rem', paddingTop: '0.35rem', borderTop: '1px solid var(--border-subtle)', color: '#166534', fontWeight: 600 }}>
                      Decision by: {p.approved_by}
                    </div>
                  )}
                  {p.rejection_reason && (
                    <div style={{ marginTop: '0.5rem', paddingTop: '0.35rem', borderTop: '1px solid var(--border-subtle)', color: '#991b1b', fontWeight: 600 }}>
                      Reason: {p.rejection_reason}
                    </div>
                  )}
                </div>
              </div>

              {p.status === 'pending_review' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', marginTop: '1rem' }}>
                  <button
                    className="btn-secondary"
                    onClick={() => handleOpenEditProposal(p)}
                    style={{ width: '100%', fontSize: '0.78rem', padding: '0.35rem' }}
                  >
                    ✎ Edit Details
                  </button>
                  <div className="prop-actions">
                    <button className="btn-approve" onClick={() => handleOpenActionModal(p, 'approved')}>
                      ✓ Sign-Off & Execute
                    </button>
                    <button className="btn-reject" onClick={() => handleOpenActionModal(p, 'rejected')}>
                      ✕ Reject
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Decision Sign-Off Modal */}
      {activeModalProposal && (
        <div className="modal-overlay" onClick={() => setActiveModalProposal(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '0.35rem', color: 'var(--text-main)' }}>
              {actionType === 'approved' ? 'Authorize Operational Action' : 'Reject Action Proposal'}
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              Action: <strong>{activeModalProposal.title}</strong>
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>
                  Authorized Approver Role
                </label>
                <select
                  className="select-filter"
                  style={{ width: '100%' }}
                  value={approverRole}
                  onChange={(e) => setApproverRole(e.target.value)}
                >
                  <option value="Lead Pharmacist (R.Ph)">Lead Pharmacist (R.Ph)</option>
                  <option value="QA Compliance Officer">QA Compliance Officer</option>
                  <option value="Operations & Supply Chain Director">Operations & Supply Chain Director</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>
                  Approver Full Name
                </label>
                <input
                  type="text"
                  className="search-input"
                  style={{ width: '100%' }}
                  value={approverName}
                  onChange={(e) => setApproverName(e.target.value)}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>
                  Review Notes & Regulatory Justification
                </label>
                <textarea
                  className="prompt-textarea"
                  style={{ minHeight: 70 }}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button className="btn-secondary" onClick={() => setActiveModalProposal(null)} disabled={submitting}>
                  Cancel
                </button>
                <button
                  className={actionType === 'approved' ? 'btn-approve' : 'btn-reject'}
                  style={{ flex: 'none', padding: '0.5rem 1.25rem' }}
                  onClick={handleConfirmDecision}
                  disabled={submitting}
                >
                  {submitting ? 'Recording...' : actionType === 'approved' ? 'Confirm Approval' : 'Confirm Rejection'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Custom Proposal Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 540 }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '0.35rem', color: 'var(--text-main)' }}>
              Create Operational Action Proposal
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              Stage an operational intervention for Qualified Person governance and authorization.
            </p>

            <form onSubmit={handleCreateProposal} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>
                  Action Type *
                </label>
                <select
                  className="select-filter"
                  style={{ width: '100%' }}
                  value={newProposalData.action_type}
                  onChange={(e) => setNewProposalData({ ...newProposalData, action_type: e.target.value })}
                >
                  <option value="quarantine_order">Quarantine Order (Physical Isolation Lock)</option>
                  <option value="dispatch_hold">Dispatch Hold (Outward Freeze)</option>
                  <option value="purchase_order">Emergency Purchase Order (Replenishment)</option>
                  <option value="vendor_return_rma">Vendor Return RMA (Credit Salvage)</option>
                  <option value="customer_notice">Customer Recall Communication</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>
                  Proposal Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Preventive Quarantine of Batch B3011 in North Depot"
                  className="search-input"
                  style={{ width: '100%' }}
                  value={newProposalData.title}
                  onChange={(e) => setNewProposalData({ ...newProposalData, title: e.target.value })}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>
                  Target Entity (Batch / Facility / Supplier) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Batch B3011 / North Cold Facility"
                  className="search-input"
                  style={{ width: '100%' }}
                  value={newProposalData.target_entity}
                  onChange={(e) => setNewProposalData({ ...newProposalData, target_entity: e.target.value })}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>
                  Operational Description *
                </label>
                <textarea
                  required
                  className="prompt-textarea"
                  style={{ minHeight: 60 }}
                  placeholder="Detail the exact operational containment or dispatch freeze step..."
                  value={newProposalData.description}
                  onChange={(e) => setNewProposalData({ ...newProposalData, description: e.target.value })}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>
                    Clinical / Regulatory Rationale *
                  </label>
                  <textarea
                    required
                    className="prompt-textarea"
                    style={{ minHeight: 50 }}
                    placeholder="e.g. Temperature breach above 8°C"
                    value={newProposalData.rationale}
                    onChange={(e) => setNewProposalData({ ...newProposalData, rationale: e.target.value })}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>
                    Expected Impact *
                  </label>
                  <textarea
                    required
                    className="prompt-textarea"
                    style={{ minHeight: 50 }}
                    placeholder="e.g. Prevents patient exposure"
                    value={newProposalData.expected_impact}
                    onChange={(e) => setNewProposalData({ ...newProposalData, expected_impact: e.target.value })}
                  />
                </div>
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
                <button type="submit" className="btn-primary" disabled={submittingCreate}>
                  {submittingCreate ? 'Staging...' : 'Stage for Approval'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Proposal Modal */}
      {editingProposal && (
        <div className="modal-overlay" onClick={() => setEditingProposal(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '0.35rem', color: 'var(--text-main)' }}>
              Edit Action Proposal #{editingProposal.id}
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              Refine proposal language or regulatory justifications before authorizing.
            </p>

            <form onSubmit={handleUpdateProposal} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>
                  Proposal Title
                </label>
                <input
                  type="text"
                  required
                  className="search-input"
                  style={{ width: '100%' }}
                  value={editProposalData.title || ''}
                  onChange={(e) => setEditProposalData({ ...editProposalData, title: e.target.value })}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>
                  Description
                </label>
                <textarea
                  required
                  className="prompt-textarea"
                  style={{ minHeight: 65 }}
                  value={editProposalData.description || ''}
                  onChange={(e) => setEditProposalData({ ...editProposalData, description: e.target.value })}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>
                  Rationale
                </label>
                <textarea
                  required
                  className="prompt-textarea"
                  style={{ minHeight: 50 }}
                  value={editProposalData.rationale || ''}
                  onChange={(e) => setEditProposalData({ ...editProposalData, rationale: e.target.value })}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>
                  Expected Impact
                </label>
                <textarea
                  required
                  className="prompt-textarea"
                  style={{ minHeight: 50 }}
                  value={editProposalData.expected_impact || ''}
                  onChange={(e) => setEditProposalData({ ...editProposalData, expected_impact: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setEditingProposal(null)}
                  disabled={submittingEdit}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={submittingEdit}>
                  {submittingEdit ? 'Saving...' : 'Save Updates'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
