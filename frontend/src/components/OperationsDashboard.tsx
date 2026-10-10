import type { DashboardSummary } from '../types/arogya'

interface OperationsDashboardProps {
  summary: DashboardSummary | null
  loading: boolean
  onSelectAttentionItem: (prompt: string) => void
  onNavigateToApprovals: () => void
}

export function OperationsDashboard({
  summary,
  loading,
  onSelectAttentionItem,
  onNavigateToApprovals,
}: OperationsDashboardProps) {
  if (loading) {
    return (
      <div style={{ padding: '3rem 0', textAlign: 'center', color: 'var(--text-muted)' }}>
        Loading pharmaceutical operations data from backend...
      </div>
    )
  }

  if (!summary) {
    return (
      <div style={{ padding: '3rem 0', textAlign: 'center', color: 'var(--text-muted)' }}>
        No operational metrics available.
      </div>
    )
  }

  return (
    <div>
      {/* Metrics Row */}
      <div className="metrics-grid">
        <div className="metric-card">
          <span className="metric-label">Tracked Catalog</span>
          <span className="metric-value">{summary.total_products}</span>
          <span className="metric-sub">{summary.total_batches} active batch lots</span>
        </div>

        <div className="metric-card alert-card">
          <span className="metric-label">Active Recalls</span>
          <span className="metric-value" style={{ color: 'var(--accent-terracotta)' }}>
            {summary.active_recalls}
          </span>
          <span className="metric-sub">Class II regulatory notice</span>
        </div>

        <div className="metric-card">
          <span className="metric-label">Cold-Chain Excursions</span>
          <span className="metric-value" style={{ color: summary.cold_chain_exceptions > 0 ? '#b45309' : 'inherit' }}>
            {summary.cold_chain_exceptions}
          </span>
          <span className="metric-sub">Thermal breaches &gt;8°C</span>
        </div>

        <div className="metric-card">
          <span className="metric-label">Batches Near Expiry</span>
          <span className="metric-value">{summary.batches_near_expiry}</span>
          <span className="metric-sub">Within 90-day horizon</span>
        </div>

        <div
          className="metric-card"
          onClick={onNavigateToApprovals}
          style={{ cursor: 'pointer' }}
          title="Click to view Approval Center"
        >
          <span className="metric-label">Pending Approvals</span>
          <span className="metric-value" style={{ color: summary.pending_approvals > 0 ? 'var(--accent-terracotta)' : 'inherit' }}>
            {summary.pending_approvals}
          </span>
          <span className="metric-sub">Pharmacist sign-off required &rarr;</span>
        </div>
      </div>

      {/* Prioritized Attention Items */}
      <div className="attention-section">
        <div className="section-header">
          <div>
            <h2>What Needs Attention Today?</h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Prioritized operational exceptions identified by continuous telemetry and inventory reconciliation.
            </p>
          </div>
          <span className="badge badge-online">
            {summary.attention_items.length} Active Items
          </span>
        </div>

        <div className="attention-list">
          {summary.attention_items.map((item) => (
            <div key={item.id} className="attention-card">
              <div className="attention-info">
                <div className="attention-title-row">
                  <span className={item.priority === 'critical' ? 'tag-critical' : 'tag-high'}>
                    {item.priority.toUpperCase()}
                  </span>
                  {item.batch_number && (
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', fontWeight: 600 }}>
                      [{item.batch_number}]
                    </span>
                  )}
                  <span className="attention-title">{item.title}</span>
                </div>
                <p className="attention-desc">{item.description}</p>
              </div>

              <button
                className="btn-primary"
                onClick={() => onSelectAttentionItem(item.action_prompt)}
                title="Launch agent autonomous investigation"
              >
                <span>Investigate</span> &rarr;
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

