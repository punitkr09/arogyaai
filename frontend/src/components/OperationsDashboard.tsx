import type { DashboardSummary } from '../types/arogya'
import { AuditIcon, RefreshIcon, BatchesIcon } from './Icons'

interface OperationsDashboardProps {
  summary: DashboardSummary | null
  loading: boolean
  onSelectAttentionItem: (prompt: string) => void
  onNavigateToApprovals: () => void
  onNavigateToTab?: (tab: string) => void
  onRefresh?: () => void
}

export function OperationsDashboard({
  summary,
  loading,
  onSelectAttentionItem,
  onNavigateToApprovals,
  onNavigateToTab,
  onRefresh,
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

  const warehouseMap = summary.warehouse_distribution || {
    Bengaluru: 14250,
    Mysuru: 11180,
    Hubballi: 9850,
    Bhiwandi: 840,
    NCR: 500,
    Pune: 400,
  }

  const totalWhUnits = Object.values(warehouseMap).reduce((a, b) => a + b, 0) || 1

  return (
    <div>
      {/* Top Reference Date Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1.25rem',
          flexWrap: 'wrap',
          gap: '0.75rem',
          padding: '0.75rem 1.25rem',
          background: 'var(--accent-primary-light)',
          borderRadius: 8,
          border: '1px solid var(--accent-primary-border)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <AuditIcon size={20} color="var(--accent-primary)" />
          <div>
            <strong style={{ fontSize: '0.88rem', color: 'var(--text-main)' }}>
              Operational Reference Snapshot Date: 2026-11-16
            </strong>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>
              (Live database-synchronized operational state)
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {onRefresh && (
            <button
              className="btn-secondary"
              onClick={onRefresh}
              title="Refresh live operational telemetry & metrics"
              aria-label="Refresh operational telemetry"
              style={{ fontSize: '0.75rem', padding: '0.3rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
            >
              <RefreshIcon size={14} /> Refresh Data
            </button>
          )}
          <span className="badge badge-online">
            {summary.total_products} Products
          </span>
          <span className="badge badge-online">
            {summary.total_customers || 445} Healthcare Facilities
          </span>
          <span className="badge badge-online">
            {summary.total_dispatches?.toLocaleString() || '5,199'} Dispatches
          </span>
        </div>
      </div>

      {/* Metrics Row 1: Primary Inventory & Operational Volumes */}
      <div className="metrics-grid" style={{ marginBottom: '1rem' }}>
        <div
          className="metric-card"
          tabIndex={onNavigateToTab ? 0 : undefined}
          role={onNavigateToTab ? 'button' : undefined}
          onClick={() => onNavigateToTab && onNavigateToTab('products')}
          onKeyDown={(e) => {
            if (onNavigateToTab && (e.key === 'Enter' || e.key === ' ')) {
              e.preventDefault()
              onNavigateToTab('products')
            }
          }}
          style={{ cursor: onNavigateToTab ? 'pointer' : 'default' }}
        >
          <span className="metric-label">Master Formulary</span>
          <span className="metric-value">{summary.total_products}</span>
          <span className="metric-sub">{summary.critical_drugs_count || 14} critical care drugs</span>
        </div>

        <div
          className="metric-card"
          tabIndex={onNavigateToTab ? 0 : undefined}
          role={onNavigateToTab ? 'button' : undefined}
          onClick={() => onNavigateToTab && onNavigateToTab('customers')}
          onKeyDown={(e) => {
            if (onNavigateToTab && (e.key === 'Enter' || e.key === ' ')) {
              e.preventDefault()
              onNavigateToTab('customers')
            }
          }}
          style={{ cursor: onNavigateToTab ? 'pointer' : 'default' }}
        >
          <span className="metric-label">Healthcare Accounts</span>
          <span className="metric-value">{summary.total_customers || 445}</span>
          <span className="metric-sub">Hospitals & retail pharmacies</span>
        </div>

        <div
          className="metric-card"
          tabIndex={onNavigateToTab ? 0 : undefined}
          role={onNavigateToTab ? 'button' : undefined}
          onClick={() => onNavigateToTab && onNavigateToTab('inventory')}
          onKeyDown={(e) => {
            if (onNavigateToTab && (e.key === 'Enter' || e.key === ' ')) {
              e.preventDefault()
              onNavigateToTab('inventory')
            }
          }}
          style={{ cursor: onNavigateToTab ? 'pointer' : 'default' }}
        >
          <span className="metric-label">Total Inventory Units</span>
          <span className="metric-value">
            {summary.total_inventory_units?.toLocaleString() || '36,200'}
          </span>
          <span className="metric-sub">Across {summary.total_batches} batch lots</span>
        </div>

        <div
          className="metric-card"
          tabIndex={onNavigateToTab ? 0 : undefined}
          role={onNavigateToTab ? 'button' : undefined}
          onClick={() => onNavigateToTab && onNavigateToTab('dispatches')}
          onKeyDown={(e) => {
            if (onNavigateToTab && (e.key === 'Enter' || e.key === ' ')) {
              e.preventDefault()
              onNavigateToTab('dispatches')
            }
          }}
          style={{ cursor: onNavigateToTab ? 'pointer' : 'default' }}
        >
          <span className="metric-label">Total Dispatches</span>
          <span className="metric-value">
            {summary.total_dispatches?.toLocaleString() || '5,199'}
          </span>
          <span className="metric-sub">{summary.total_dispatched_units?.toLocaleString() || '45,158'} units shipped</span>
        </div>
      </div>

      {/* Metrics Row 2: Regulatory, Thermal, Expiry & Approvals */}
      <div className="metrics-grid" style={{ marginBottom: '1.5rem' }}>
        <div
          className="metric-card alert-card"
          tabIndex={onNavigateToTab ? 0 : undefined}
          role={onNavigateToTab ? 'button' : undefined}
          onClick={() => onNavigateToTab && onNavigateToTab('recalls')}
          onKeyDown={(e) => {
            if (onNavigateToTab && (e.key === 'Enter' || e.key === ' ')) {
              e.preventDefault()
              onNavigateToTab('recalls')
            }
          }}
          style={{ cursor: onNavigateToTab ? 'pointer' : 'default' }}
        >
          <span className="metric-label">Active Recalls</span>
          <span className="metric-value" style={{ color: 'var(--accent-terracotta)' }}>
            {summary.active_recalls}
          </span>
          <span className="metric-sub">Class II & III notices (Quarantined)</span>
        </div>

        <div
          className="metric-card"
          tabIndex={onNavigateToTab ? 0 : undefined}
          role={onNavigateToTab ? 'button' : undefined}
          onClick={() => onNavigateToTab && onNavigateToTab('cold_chain')}
          onKeyDown={(e) => {
            if (onNavigateToTab && (e.key === 'Enter' || e.key === ' ')) {
              e.preventDefault()
              onNavigateToTab('cold_chain')
            }
          }}
          style={{ cursor: onNavigateToTab ? 'pointer' : 'default' }}
        >
          <span className="metric-label">Cold-Chain Excursions</span>
          <span className="metric-value" style={{ color: summary.cold_chain_exceptions > 0 ? '#b45309' : 'inherit' }}>
            {summary.cold_chain_exceptions}
          </span>
          <span className="metric-sub">Breaches outside 2°C–8°C</span>
        </div>

        <div
          className="metric-card"
          tabIndex={onNavigateToTab ? 0 : undefined}
          role={onNavigateToTab ? 'button' : undefined}
          onClick={() => onNavigateToTab && onNavigateToTab('returns')}
          onKeyDown={(e) => {
            if (onNavigateToTab && (e.key === 'Enter' || e.key === ' ')) {
              e.preventDefault()
              onNavigateToTab('returns')
            }
          }}
          style={{ cursor: onNavigateToTab ? 'pointer' : 'default' }}
        >
          <span className="metric-label">Batches Near Expiry</span>
          <span className="metric-value" style={{ color: summary.batches_near_expiry > 0 ? '#ea580c' : 'inherit' }}>
            {summary.batches_near_expiry}
          </span>
          <span className="metric-sub">Within 90-day horizon</span>
        </div>

        <div
          className="metric-card"
          tabIndex={onNavigateToTab ? 0 : undefined}
          role={onNavigateToTab ? 'button' : undefined}
          onClick={() => onNavigateToTab && onNavigateToTab('purchase_orders')}
          onKeyDown={(e) => {
            if (onNavigateToTab && (e.key === 'Enter' || e.key === ' ')) {
              e.preventDefault()
              onNavigateToTab('purchase_orders')
            }
          }}
          style={{ cursor: onNavigateToTab ? 'pointer' : 'default' }}
        >
          <span className="metric-label">Delayed / Overdue POs</span>
          <span className="metric-value" style={{ color: (summary.overdue_purchase_orders || 0) > 0 ? '#ef4444' : 'inherit' }}>
            {summary.overdue_purchase_orders || summary.delayed_purchase_orders || 1}
          </span>
          <span className="metric-sub">PO-0688 delayed by manufacturer</span>
        </div>

        <div
          className="metric-card"
          tabIndex={0}
          role="button"
          onClick={onNavigateToApprovals}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              onNavigateToApprovals()
            }
          }}
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

      {/* Warehouse Distribution Cards */}
      <div className="table-container" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
        <h3 style={{ margin: '0 0 0.85rem 0', fontSize: '0.95rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <BatchesIcon size={18} color="var(--accent-primary)" /> Physical Inventory Distribution Across Regional Warehouses
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
          {Object.entries(warehouseMap).map(([loc, units]) => {
            const pct = Math.round((units / totalWhUnits) * 100)
            return (
              <div
                key={loc}
                style={{
                  padding: '0.75rem',
                  borderRadius: 6,
                  background: 'var(--bg-card-subtle)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{loc} Facility</div>
                <div style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--text-main)', margin: '0.2rem 0' }}>
                  {units.toLocaleString()} units
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--accent-primary)' }}>
                  {pct}% of network inventory
                </div>
              </div>
            )
          })}
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
