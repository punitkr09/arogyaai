import { useCallback, useEffect, useState } from 'react'
import type { ActionProposal } from '../types/arogya'
import { fetchProposals, actOnProposal } from '../services/api'

interface ApprovalCenterViewProps {
  onApprovalSuccess?: () => void
}

export function ApprovalCenterView({ onApprovalSuccess }: ApprovalCenterViewProps) {
  const [proposals, setProposals] = useState<ActionProposal[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [statusFilter, setStatusFilter] = useState<string>('pending_review')

  // Action Modal State
  const [activeModalProposal, setActiveModalProposal] = useState<ActionProposal | null>(null)
  const [actionType, setActionType] = useState<'approved' | 'rejected'>('approved')
  const [approverRole, setApproverRole] = useState<string>('Lead Pharmacist (R.Ph)')
  const [approverName, setApproverName] = useState<string>('Dr. Ananya Sharma, R.Ph')
  const [notes, setNotes] = useState<string>('Reviewed trace records and verified 25 recipient coverage.')
  const [submitting, setSubmitting] = useState<boolean>(false)
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null)

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

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <div>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.2rem' }}>
            Operations & Compliance Approval Center
          </h2>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            Human-in-the-Loop Governance: Consequential operational actions (dispatch freeze, PO submission, quarantine) require authorized sign-off.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
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
            All History
          </button>
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
                <div className="prop-actions">
                  <button className="btn-approve" onClick={() => handleOpenActionModal(p, 'approved')}>
                    ✓ Sign-Off & Execute
                  </button>
                  <button className="btn-reject" onClick={() => handleOpenActionModal(p, 'rejected')}>
                    ✕ Reject
                  </button>
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
    </div>
  )
}
