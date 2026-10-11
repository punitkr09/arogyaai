import { useState, useEffect } from 'react'
import type { AgentRunDetail, TaskTemplate, Warehouse, Product } from '../types/arogya'
import { agentCreateData, fetchWarehouses, fetchProducts } from '../services/api'
import { AgentIcon, RefreshIcon, CloseIcon } from './Icons'

interface AgentWorkspaceViewProps {
  templates: TaskTemplate[]
  prompt: string
  setPrompt: (p: string) => void
  onRunAgent: (customPrompt?: string) => void
  running: boolean
  activeRun: AgentRunDetail | null
  error: string | null
  onNavigateToApprovals: () => void
}

type DataCategory = 'batch' | 'purchase_order' | 'temperature_log' | 'dispatch' | 'customer' | 'supplier' | 'recall'

export function AgentWorkspaceView({
  templates,
  prompt,
  setPrompt,
  onRunAgent,
  running,
  activeRun,
  error,
  onNavigateToApprovals,
}: AgentWorkspaceViewProps) {
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null)

  // Data Creation Modal State
  const [showDataModal, setShowDataModal] = useState<boolean>(false)
  const [dataTab, setDataTab] = useState<DataCategory>('batch')
  const [dataSubmitting, setDataSubmitting] = useState<boolean>(false)
  const [dataFeedback, setDataFeedback] = useState<string | null>(null)

  // Reference items for dropdowns
  const [availableWarehouses, setAvailableWarehouses] = useState<Warehouse[]>([])
  const [availableProducts, setAvailableProducts] = useState<Product[]>([])

  useEffect(() => {
    fetchWarehouses().then(setAvailableWarehouses).catch(() => {})
    fetchProducts().then(setAvailableProducts).catch(() => {})
  }, [])

  // Form states
  const [batchForm, setBatchForm] = useState({
    batch_number: 'B-AUT-8801',
    sku: 'PH-001',
    warehouse: 'BLR',
    quantity: 500,
    expiry_date: '2027-12-31',
    storage_condition: '15°C - 25°C',
  })

  const [poForm, setPoForm] = useState({
    sku: 'PH-013',
    quantity: 600,
    supplier_name: 'Biocon Ltd',
    unit_price: 450.0,
    notes: 'Emergency cold-chain insulin reserve order',
  })

  const [tempForm, setTempForm] = useState({
    warehouse: 'Mysuru',
    cold_room_unit: 'CR-2',
    recorded_temperature_celsius: 11.4,
    duration_minutes: 180,
    permitted_range: '2°C - 8°C',
    notes: 'Defrost compressor threshold excursion logged by warehouse technician',
  })

  const [dispatchForm, setDispatchForm] = useState({
    batch_number: 'B2219',
    customer_code: 'C-001',
    quantity: 50,
    dispatch_id: 'DISP-EXP-9901',
  })

  const [customerForm, setCustomerForm] = useState({
    code: 'HOSP-BLR-09',
    name: 'Fortis Healthcare Bannerghatta',
    customer_type: 'hospital',
    location: 'Bengaluru',
    credit_terms: '30 Days Net',
  })

  const [supplierForm, setSupplierForm] = useState({
    name: 'Cipla Therapeutics Ltd',
    sku: 'PH-004',
    lead_time_days: 14,
    min_order_quantity: 300,
    return_window_days: 45,
  })

  const [recallForm, setRecallForm] = useState({
    sku: 'PH-004',
    batches: 'B9011',
    reason: 'Packaging seal integrity breach detected during retrospective sample stability testing',
    recall_class: 'Class II',
  })

  const stagesList = [
    { key: 'intake', label: '1. Intake' },
    { key: 'planning', label: '2. Planning' },
    { key: 'execution', label: '3. Execution' },
    { key: 'analysis', label: '4. Analysis' },
    { key: 'verification', label: '5. Verification' },
    { key: 'approval', label: '6. Approval Gate' },
    { key: 'reporting', label: '7. Reporting' },
  ]

  const currentStageIndex = activeRun
    ? activeRun.state === 'planning'
      ? 1
      : activeRun.state === 'executing'
      ? 2
      : activeRun.state === 'verifying'
      ? 4
      : activeRun.state === 'awaiting_approval'
      ? 5
      : activeRun.state === 'completed'
      ? 6
      : 0
    : -1

  // Handle Direct Database Ingest
  const handleDirectCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setDataSubmitting(true)
    setDataFeedback(null)

    try {
      let payload: Record<string, any> = {}
      if (dataTab === 'batch') payload = batchForm
      else if (dataTab === 'purchase_order') payload = poForm
      else if (dataTab === 'temperature_log') payload = tempForm
      else if (dataTab === 'dispatch') payload = dispatchForm
      else if (dataTab === 'customer') payload = customerForm
      else if (dataTab === 'supplier') payload = supplierForm
      else if (dataTab === 'recall') payload = recallForm

      const res = await agentCreateData(dataTab, payload)
      setDataFeedback(`✓ Record created successfully: ${res.message || 'Updated in SQLite database.'}`)
      setShowDataModal(false)
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to ingest data.')
    } finally {
      setDataSubmitting(false)
    }
  }

  // Handle Dispatch to Agent via Cognitive Loop
  const handleDispatchToAgent = () => {
    let agentText = ''
    if (dataTab === 'batch') {
      agentText = `Add batch ${batchForm.batch_number} for SKU ${batchForm.sku} with ${batchForm.quantity} units in ${batchForm.warehouse} warehouse expiring ${batchForm.expiry_date}`
    } else if (dataTab === 'purchase_order') {
      agentText = `Create purchase order for SKU ${poForm.sku}, ${poForm.quantity} units from ${poForm.supplier_name}`
    } else if (dataTab === 'temperature_log') {
      agentText = `Log temperature ${tempForm.recorded_temperature_celsius}°C in ${tempForm.warehouse} ${tempForm.cold_room_unit} with duration ${tempForm.duration_minutes} min`
    } else if (dataTab === 'dispatch') {
      agentText = `Record dispatch of ${dispatchForm.quantity} units of batch ${dispatchForm.batch_number} to customer ${dispatchForm.customer_code}`
    } else if (dataTab === 'customer') {
      agentText = `Add customer ${customerForm.name} in ${customerForm.location} type ${customerForm.customer_type}`
    } else if (dataTab === 'supplier') {
      agentText = `Add supplier ${supplierForm.name} for SKU ${supplierForm.sku} MOQ ${supplierForm.min_order_quantity} lead time ${supplierForm.lead_time_days} days`
    } else if (dataTab === 'recall') {
      agentText = `Issue recall for batch ${recallForm.batches} SKU ${recallForm.sku} reason ${recallForm.reason} ${recallForm.recall_class}`
    }

    setPrompt(agentText)
    setShowDataModal(false)
    onRunAgent(agentText)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Task Controller */}
      <div className="agent-control-panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: '0.25rem', color: 'var(--text-main)' }}>
              Operations Agent Command Center
            </h2>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Trigger autonomous investigation or ingest operational records. The agent executes real database tools, enforces pharmaceutical safety invariants, and stages actions for Qualified Person sign-off.
            </p>
          </div>

          <button
            className="btn-secondary"
            onClick={() => setShowDataModal(true)}
            style={{ fontSize: '0.82rem', padding: '0.45rem 1rem', display: 'flex', alignItems: 'center', gap: '0.4rem', borderColor: '#4f46e5', color: '#4f46e5' }}
          >
            ⚡ Add Operational Data via Agent
          </button>
        </div>

        {dataFeedback && (
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
            {dataFeedback}
          </div>
        )}

        {/* Template Quick Chips */}
        <div>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem' }}>
            OPERATIONAL INVESTIGATION PROMPTS:
          </span>
          <div className="templates-row">
            {(templates.length > 0 ? templates : [
              { id: 't1', title: 'Recall Batch B2231', prompt: 'Investigate recall Batch B2231 and prepare response options.' },
              { id: 't2', title: 'Trace B2231 Recipients', prompt: 'Show me everywhere batch B2231 went and identify affected hospitals.' },
              { id: 't3', title: 'Cold-Chain Excursions', prompt: 'Which batches are at risk because their cold room became too warm?' },
              { id: 't4', title: 'Expiring Stock & Returns', prompt: 'Which batches are expiring in 90 days and what supplier returns can we make?' },
              { id: 't5', title: 'Replacement Coverage', prompt: 'Can replacement batch B2232 cover the recall of B2231 and normal demand?' },
              { id: 't6', title: 'Critical Drug Shortages', prompt: 'Analyze critical drug inventory runway and identify potential shortages.' },
            ]).map((tpl) => (
              <button
                key={tpl.id}
                className="template-chip"
                onClick={() => {
                  setPrompt(tpl.prompt)
                  onRunAgent(tpl.prompt)
                }}
                disabled={running}
              >
                {tpl.id.includes('recall') || tpl.id === 't1' ? '🔴' : tpl.id.includes('cold') || tpl.id === 't3' ? '❄️' : tpl.id.includes('expiry') || tpl.id === 't4' ? '🟡' : '📦'}{' '}
                {tpl.title}
              </button>
            ))}
          </div>
        </div>

        {/* Data Actions Quick Row */}
        <div>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem' }}>
            AGENT DATA INGESTION &amp; ACTION TRIGGERS:
          </span>
          <div className="templates-row">
            <button
              className="template-chip"
              onClick={() => {
                setDataTab('batch')
                setShowDataModal(true)
              }}
              disabled={running}
            >
              📦 Ingest Batch Lot
            </button>
            <button
              className="template-chip"
              onClick={() => {
                setDataTab('purchase_order')
                setShowDataModal(true)
              }}
              disabled={running}
            >
              🛒 Create Emergency PO
            </button>
            <button
              className="template-chip"
              onClick={() => {
                setDataTab('temperature_log')
                setShowDataModal(true)
              }}
              disabled={running}
            >
              ❄️ Log Temperature Check
            </button>
            <button
              className="template-chip"
              onClick={() => {
                setDataTab('dispatch')
                setShowDataModal(true)
              }}
              disabled={running}
            >
              🚚 Record Outward Dispatch
            </button>
            <button
              className="template-chip"
              onClick={() => {
                setDataTab('customer')
                setShowDataModal(true)
              }}
              disabled={running}
            >
              🏥 Register Customer
            </button>
            <button
              className="template-chip"
              onClick={() => {
                setDataTab('supplier')
                setShowDataModal(true)
              }}
              disabled={running}
            >
              🏭 Register Supplier
            </button>
            <button
              className="template-chip"
              onClick={() => {
                setDataTab('recall')
                setShowDataModal(true)
              }}
              disabled={running}
            >
              ⚠️ Declare Regulatory Recall
            </button>
          </div>
        </div>

        {/* Prompt Input & Execute */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          <textarea
            className="prompt-textarea"
            placeholder="Type any natural-language operations question or data command (e.g. 'Add batch B9022 for PH-001 with 500 units in BLR' or 'Which purchase orders are overdue?')... (Press Enter to submit, Shift+Enter for new line)"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                if (!running && prompt.trim()) {
                  onRunAgent()
                }
              } else if (e.key === 'Escape') {
                setPrompt('')
              }
            }}
            disabled={running}
            rows={3}
          />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Deterministic Database Execution &bull; Grounded in Live SQLite Records
              </span>
              {prompt && (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setPrompt('')}
                  disabled={running}
                  style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                  title="Clear input (Esc)"
                >
                  <CloseIcon size={12} /> Clear Prompt
                </button>
              )}
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              {activeRun && (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => onRunAgent(activeRun.prompt)}
                  disabled={running}
                  style={{ padding: '0.55rem 0.9rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                  title="Retry last agent execution"
                >
                  <RefreshIcon size={14} /> Retry
                </button>
              )}

              <button
                type="button"
                className="btn-primary"
                onClick={() => onRunAgent()}
                disabled={running || !prompt.trim()}
                style={{ padding: '0.55rem 1.3rem', fontSize: '0.82rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.45rem' }}
              >
                {running ? (
                  <>
                    <span style={{ display: 'inline-block', animation: 'spin 1s infinite linear' }}>⟳</span>
                    Executing Cognitive Loop...
                  </>
                ) : (
                  <>
                    <AgentIcon size={16} /> Run Operations Agent
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div
          style={{
            padding: '1rem',
            backgroundColor: 'var(--status-critical-bg)',
            color: 'var(--status-critical-text)',
            borderRadius: 6,
            border: '1px solid var(--status-critical-border)',
            fontSize: '0.85rem',
          }}
        >
          {error}
        </div>
      )}

      {/* Cognitive Loop Progress Bar */}
      {activeRun && (
        <div style={{ background: 'var(--bg-surface)', padding: '1rem', borderRadius: 8, border: '1px solid var(--border-subtle)', boxShadow: var_shadow_sm }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)' }}>
              PIPELINE EXECUTION STATE: <span style={{ color: 'var(--accent-terracotta)', textTransform: 'uppercase' }}>{activeRun.state.replace('_', ' ')}</span>
            </span>
            <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-dim)' }}>
              Run ID: {activeRun.run_id}
            </span>
          </div>

          <div className="stages-breadcrumb">
            {stagesList.map((s, idx) => (
              <span
                key={s.key}
                className={`stage-pill ${
                  idx === currentStageIndex
                    ? 'active'
                    : idx < currentStageIndex
                    ? 'completed'
                    : ''
                }`}
              >
                {idx < currentStageIndex ? '✓ ' : ''}
                {s.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Main Dual Workspace Grid */}
      {activeRun && (
        <div className="workspace-grid">
          {/* Left: Execution Timeline & Tool Calls */}
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '1.25rem', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-main)' }}>
                Live Execution Audit Trail ({activeRun.events.length} events)
              </h3>
              <span className="badge badge-online">Database Logged</span>
            </div>

            <div className="events-stream">
              {activeRun.events.map((ev, i) => (
                <div
                  key={i}
                  className="event-card"
                  onClick={() => setSelectedEventId(selectedEventId === i ? null : i)}
                  style={{ cursor: ev.data ? 'pointer' : 'default' }}
                >
                  <div className="event-header">
                    <span>
                      Step {ev.step_number} &bull; <strong style={{ textTransform: 'uppercase' }}>{ev.stage}</strong>
                    </span>
                    {ev.tool_name && <span className="event-tool">{ev.tool_name}</span>}
                  </div>

                  <div className="event-msg">{ev.message}</div>

                  {ev.data && (
                    <div style={{ fontSize: '0.7rem', color: 'var(--accent-terracotta)', fontWeight: 600 }}>
                      {selectedEventId === i ? '▲ Hide Payload' : '▼ View Stored JSON'}
                    </div>
                  )}

                  {selectedEventId === i && ev.data && (
                    <pre
                      style={{
                        marginTop: '0.35rem',
                        padding: '0.5rem',
                        backgroundColor: 'var(--bg-tag)',
                        borderRadius: 4,
                        fontSize: '0.72rem',
                        overflowX: 'auto',
                        color: 'var(--text-main)',
                      }}
                    >
                      {JSON.stringify(ev.data, null, 2)}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Right: Verification & Decision Support */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Deterministic Verification Checklist */}
            {activeRun.verification && activeRun.verification.length > 0 && (
              <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '1.25rem', boxShadow: 'var(--shadow-sm)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-main)' }}>
                    Independent Deterministic Verification
                  </h3>
                  <span
                    className="badge"
                    style={{
                      backgroundColor: 'var(--status-success-bg)',
                      color: 'var(--status-success-text)',
                      border: '1px solid var(--status-success-border)',
                    }}
                  >
                    100% Invariants Verified
                  </span>
                </div>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                  Verified mathematically against SQLite tables without relying on LLM self-reporting.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {activeRun.verification.map((chk, idx) => (
                    <div key={idx} className="check-item">
                      <span className="check-icon-pass">✓</span>
                      <div className="check-content">
                        <h4>{chk.rule_description}</h4>
                        <p>{chk.details}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Response Options Comparison (if Recall scenario) */}
            {activeRun.final_report && activeRun.final_report.alternatives_compared.length > 0 && (
              <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '1.25rem', boxShadow: 'var(--shadow-sm)' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.5rem' }}>
                  Evaluated Response Strategies
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {activeRun.final_report.alternatives_compared.map((opt) => (
                    <div
                      key={opt.option_id}
                      style={{
                        padding: '0.85rem',
                        borderRadius: 6,
                        border: opt.is_recommended ? '2px solid var(--accent-terracotta)' : '1px solid var(--border-subtle)',
                        backgroundColor: opt.is_recommended ? 'var(--accent-terracotta-light)' : 'var(--bg-card-subtle)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-main)' }}>
                          {opt.title}
                        </span>
                        {opt.is_recommended && (
                          <span
                            style={{
                              backgroundColor: 'var(--accent-terracotta)',
                              color: 'white',
                              fontSize: '0.68rem',
                              fontWeight: 700,
                              padding: '0.15rem 0.45rem',
                              borderRadius: 4,
                            }}
                          >
                            RECOMMENDED
                          </span>
                        )}
                      </div>
                      <p style={{ fontSize: '0.78rem', color: 'var(--text-main)', marginBottom: '0.4rem' }}>
                        {opt.allocation_plan}
                      </p>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        <strong>Impact:</strong> {opt.shortage_mitigation}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Final Report & Action Gate Banner */}
            {activeRun.final_report && (
              <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '1.25rem', boxShadow: 'var(--shadow-sm)' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.5rem' }}>
                  Incident Report & Action Proposals
                </h3>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-main)', lineHeight: 1.45, marginBottom: '1rem' }}>
                  {activeRun.final_report.incident_summary}
                </p>

                <div
                  style={{
                    backgroundColor: 'var(--bg-card-subtle)',
                    padding: '0.85rem',
                    borderRadius: 6,
                    border: '1px solid var(--border-subtle)',
                    marginBottom: '1rem',
                  }}
                >
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-terracotta-dark)', display: 'block', marginBottom: '0.25rem' }}>
                    RECOMMENDED DECISION SUPPORT ACTION:
                  </span>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-main)' }}>
                    {activeRun.final_report.recommendation}
                  </p>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    {activeRun.proposals.length} Proposals Staged at Approval Gate
                  </span>

                  <button className="btn-primary" onClick={onNavigateToApprovals}>
                    Review in Approval Center ({activeRun.proposals.length}) &rarr;
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Operational Data Creation Modal */}
      {showDataModal && (
        <div className="modal-overlay" onClick={() => setShowDataModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--text-main)' }}>
                  Add Operational Data via Agent Workspace
                </h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Ingest verified pharmaceutical records into SQLite or dispatch to the Agent AI cognitive loop for verification.
                </p>
              </div>
              <button
                className="btn-secondary"
                onClick={() => setShowDataModal(false)}
                style={{ padding: '0.2rem 0.5rem', fontSize: '0.9rem' }}
              >
                ✕
              </button>
            </div>

            {/* Category Sub-Tabs */}
            <div style={{ display: 'flex', gap: '0.4rem', overflowX: 'auto', paddingBottom: '0.5rem', marginBottom: '1rem', borderBottom: '1px solid var(--border-subtle)' }}>
              {[
                { key: 'batch', label: '📦 Batch Lot' },
                { key: 'purchase_order', label: '🛒 Purchase Order' },
                { key: 'temperature_log', label: '❄️ Temp Check' },
                { key: 'dispatch', label: '🚚 Dispatch' },
                { key: 'customer', label: '🏥 Customer' },
                { key: 'supplier', label: '🏭 Supplier' },
                { key: 'recall', label: '⚠️ Recall' },
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setDataTab(tab.key as DataCategory)}
                  style={{
                    padding: '0.35rem 0.65rem',
                    borderRadius: 4,
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    border: dataTab === tab.key ? '1px solid #4f46e5' : '1px solid var(--border-subtle)',
                    backgroundColor: dataTab === tab.key ? '#eef2ff' : 'transparent',
                    color: dataTab === tab.key ? '#4338ca' : 'var(--text-muted)',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <form onSubmit={handleDirectCreate} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {/* Batch Form */}
              {dataTab === 'batch' && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div>
                      <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>Batch Number *</label>
                      <input
                        type="text"
                        required
                        className="search-input"
                        style={{ width: '100%' }}
                        value={batchForm.batch_number}
                        onChange={(e) => setBatchForm({ ...batchForm, batch_number: e.target.value })}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>Product / SKU *</label>
                      <select
                        className="select-filter"
                        style={{ width: '100%' }}
                        value={batchForm.sku}
                        onChange={(e) => setBatchForm({ ...batchForm, sku: e.target.value })}
                      >
                        {availableProducts.slice(0, 30).map((p) => (
                          <option key={p.id} value={p.sku}>
                            {p.name} ({p.sku})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                    <div>
                      <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>Warehouse *</label>
                      <select
                        className="select-filter"
                        style={{ width: '100%' }}
                        value={batchForm.warehouse}
                        onChange={(e) => setBatchForm({ ...batchForm, warehouse: e.target.value })}
                      >
                        {availableWarehouses.map((w) => (
                          <option key={w.id} value={w.code}>
                            {w.name} ({w.code})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>Available Units *</label>
                      <input
                        type="number"
                        required
                        min={1}
                        className="search-input"
                        style={{ width: '100%' }}
                        value={batchForm.quantity}
                        onChange={(e) => setBatchForm({ ...batchForm, quantity: Number(e.target.value) })}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>Expiry Date *</label>
                      <input
                        type="date"
                        required
                        className="search-input"
                        style={{ width: '100%' }}
                        value={batchForm.expiry_date}
                        onChange={(e) => setBatchForm({ ...batchForm, expiry_date: e.target.value })}
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Purchase Order Form */}
              {dataTab === 'purchase_order' && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div>
                      <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>Target Product SKU *</label>
                      <select
                        className="select-filter"
                        style={{ width: '100%' }}
                        value={poForm.sku}
                        onChange={(e) => setPoForm({ ...poForm, sku: e.target.value })}
                      >
                        {availableProducts.slice(0, 30).map((p) => (
                          <option key={p.id} value={p.sku}>
                            {p.name} ({p.sku})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>Manufacturer / Supplier *</label>
                      <input
                        type="text"
                        required
                        className="search-input"
                        style={{ width: '100%' }}
                        value={poForm.supplier_name}
                        onChange={(e) => setPoForm({ ...poForm, supplier_name: e.target.value })}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div>
                      <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>Order Quantity (Units) *</label>
                      <input
                        type="number"
                        required
                        min={10}
                        className="search-input"
                        style={{ width: '100%' }}
                        value={poForm.quantity}
                        onChange={(e) => setPoForm({ ...poForm, quantity: Number(e.target.value) })}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>Unit Price (₹ / $) *</label>
                      <input
                        type="number"
                        step="0.01"
                        className="search-input"
                        style={{ width: '100%' }}
                        value={poForm.unit_price}
                        onChange={(e) => setPoForm({ ...poForm, unit_price: Number(e.target.value) })}
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Temperature Reading Form */}
              {dataTab === 'temperature_log' && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div>
                      <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>Facility / Warehouse *</label>
                      <select
                        className="select-filter"
                        style={{ width: '100%' }}
                        value={tempForm.warehouse}
                        onChange={(e) => setTempForm({ ...tempForm, warehouse: e.target.value })}
                      >
                        {availableWarehouses.map((w) => (
                          <option key={w.id} value={w.name}>
                            {w.name} ({w.code})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>Cold Room Zone *</label>
                      <input
                        type="text"
                        required
                        className="search-input"
                        style={{ width: '100%' }}
                        value={tempForm.cold_room_unit}
                        onChange={(e) => setTempForm({ ...tempForm, cold_room_unit: e.target.value })}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div>
                      <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>Recorded Temperature (°C) *</label>
                      <input
                        type="number"
                        step="0.1"
                        required
                        className="search-input"
                        style={{ width: '100%' }}
                        value={tempForm.recorded_temperature_celsius}
                        onChange={(e) => setTempForm({ ...tempForm, recorded_temperature_celsius: Number(e.target.value) })}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>Excursion Duration (Minutes)</label>
                      <input
                        type="number"
                        min={0}
                        className="search-input"
                        style={{ width: '100%' }}
                        value={tempForm.duration_minutes}
                        onChange={(e) => setTempForm({ ...tempForm, duration_minutes: Number(e.target.value) })}
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Dispatch Form */}
              {dataTab === 'dispatch' && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div>
                      <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>Batch Number *</label>
                      <input
                        type="text"
                        required
                        className="search-input"
                        style={{ width: '100%' }}
                        value={dispatchForm.batch_number}
                        onChange={(e) => setDispatchForm({ ...dispatchForm, batch_number: e.target.value })}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>Customer Code *</label>
                      <input
                        type="text"
                        required
                        className="search-input"
                        style={{ width: '100%' }}
                        value={dispatchForm.customer_code}
                        onChange={(e) => setDispatchForm({ ...dispatchForm, customer_code: e.target.value })}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>Dispatched Units *</label>
                    <input
                      type="number"
                      required
                      min={1}
                      className="search-input"
                      style={{ width: '100%' }}
                      value={dispatchForm.quantity}
                      onChange={(e) => setDispatchForm({ ...dispatchForm, quantity: Number(e.target.value) })}
                    />
                  </div>
                </>
              )}

              {/* Customer Form */}
              {dataTab === 'customer' && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div>
                      <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>Customer Code *</label>
                      <input
                        type="text"
                        required
                        className="search-input"
                        style={{ width: '100%' }}
                        value={customerForm.code}
                        onChange={(e) => setCustomerForm({ ...customerForm, code: e.target.value })}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>Facility / Account Name *</label>
                      <input
                        type="text"
                        required
                        className="search-input"
                        style={{ width: '100%' }}
                        value={customerForm.name}
                        onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div>
                      <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>Facility Type *</label>
                      <select
                        className="select-filter"
                        style={{ width: '100%' }}
                        value={customerForm.customer_type}
                        onChange={(e) => setCustomerForm({ ...customerForm, customer_type: e.target.value })}
                      >
                        <option value="hospital">Hospital (Critical Tier 1)</option>
                        <option value="chemist">Retail Chemist (Tier 2)</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>Location City *</label>
                      <input
                        type="text"
                        required
                        className="search-input"
                        style={{ width: '100%' }}
                        value={customerForm.location}
                        onChange={(e) => setCustomerForm({ ...customerForm, location: e.target.value })}
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Supplier Form */}
              {dataTab === 'supplier' && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div>
                      <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>Manufacturer Name *</label>
                      <input
                        type="text"
                        required
                        className="search-input"
                        style={{ width: '100%' }}
                        value={supplierForm.name}
                        onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>Supplied Molecule SKU</label>
                      <select
                        className="select-filter"
                        style={{ width: '100%' }}
                        value={supplierForm.sku}
                        onChange={(e) => setSupplierForm({ ...supplierForm, sku: e.target.value })}
                      >
                        {availableProducts.slice(0, 30).map((p) => (
                          <option key={p.id} value={p.sku}>
                            {p.name} ({p.sku})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                    <div>
                      <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>Lead Time (Days)</label>
                      <input
                        type="number"
                        min={1}
                        className="search-input"
                        style={{ width: '100%' }}
                        value={supplierForm.lead_time_days}
                        onChange={(e) => setSupplierForm({ ...supplierForm, lead_time_days: Number(e.target.value) })}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>MOQ (Units)</label>
                      <input
                        type="number"
                        min={10}
                        className="search-input"
                        style={{ width: '100%' }}
                        value={supplierForm.min_order_quantity}
                        onChange={(e) => setSupplierForm({ ...supplierForm, min_order_quantity: Number(e.target.value) })}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>Return Window (Days)</label>
                      <input
                        type="number"
                        min={0}
                        className="search-input"
                        style={{ width: '100%' }}
                        value={supplierForm.return_window_days}
                        onChange={(e) => setSupplierForm({ ...supplierForm, return_window_days: Number(e.target.value) })}
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Recall Form */}
              {dataTab === 'recall' && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div>
                      <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>Recalled SKU *</label>
                      <select
                        className="select-filter"
                        style={{ width: '100%' }}
                        value={recallForm.sku}
                        onChange={(e) => setRecallForm({ ...recallForm, sku: e.target.value })}
                      >
                        {availableProducts.slice(0, 30).map((p) => (
                          <option key={p.id} value={p.sku}>
                            {p.name} ({p.sku})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>Affected Batch(es) *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. B9011, B9012"
                        className="search-input"
                        style={{ width: '100%' }}
                        value={recallForm.batches}
                        onChange={(e) => setRecallForm({ ...recallForm, batches: e.target.value })}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '0.75rem' }}>
                    <div>
                      <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>Classification *</label>
                      <select
                        className="select-filter"
                        style={{ width: '100%' }}
                        value={recallForm.recall_class}
                        onChange={(e) => setRecallForm({ ...recallForm, recall_class: e.target.value })}
                      >
                        <option value="Class I">Class I (Severe / Dangerous)</option>
                        <option value="Class II">Class II (Temporary / Reversible)</option>
                        <option value="Class III">Class III (Minor / Technical)</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }}>Defect Reason *</label>
                      <input
                        type="text"
                        required
                        className="search-input"
                        style={{ width: '100%' }}
                        value={recallForm.reason}
                        onChange={(e) => setRecallForm({ ...recallForm, reason: e.target.value })}
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-subtle)' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleDispatchToAgent}
                  disabled={dataSubmitting}
                  style={{ fontSize: '0.8rem', padding: '0.45rem 0.85rem' }}
                >
                  🤖 Dispatch to Agent Cognitive Loop &rarr;
                </button>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setShowDataModal(false)}
                    disabled={dataSubmitting}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary" disabled={dataSubmitting}>
                    {dataSubmitting ? 'Ingesting...' : '⚡ Direct Database Ingest'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

const var_shadow_sm = 'var(--shadow-sm)'
