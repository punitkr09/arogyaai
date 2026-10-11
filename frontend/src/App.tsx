import { useCallback, useEffect, useState } from 'react'
import type { HealthResponse } from './types/workflow'
import type { DashboardSummary, AgentRunDetail, TaskTemplate } from './types/arogya'
import {
  fetchHealth,
  fetchDashboardSummary,
  fetchAgentTemplates,
  fetchAIStatus,
  type AIStatusResponse,
  runAgentTask,
} from './services/api'
import { Header } from './components/Header'
import { Sidebar } from './components/Sidebar'
import { OfflineModelRequiredModal } from './components/OfflineModelRequiredModal'
import { OperationsDashboard } from './components/OperationsDashboard'
import { BatchExplorer } from './components/BatchExplorer'
import { ProductCatalogueView } from './components/ProductCatalogueView'
import { CustomerManagementView } from './components/CustomerManagementView'
import { SupplierManagementView } from './components/SupplierManagementView'
import { PurchaseOrdersView } from './components/PurchaseOrdersView'
import { DispatchAnalyticsView } from './components/DispatchAnalyticsView'
import { RecallManagementView } from './components/RecallManagementView'
import { BatchTraceabilityView } from './components/BatchTraceabilityView'
import { ColdChainView } from './components/ColdChainView'
import { ExpiryReturnsView } from './components/ExpiryReturnsView'
import { ShortagePlanningView } from './components/ShortagePlanningView'
import { AgentWorkspaceView } from './components/AgentWorkspaceView'
import { ApprovalCenterView } from './components/ApprovalCenterView'
import { WhatIfSimulatorView } from './components/WhatIfSimulatorView'
import { AuditLogView } from './components/AuditLogView'
import { SettingsView } from './components/SettingsView'
import {
  OverviewIcon,
  BatchesIcon,
  ProductsIcon,
  CustomersIcon,
  SuppliersIcon,
  OrdersIcon,
  DispatchesIcon,
  RecallsIcon,
  TraceabilityIcon,
  ColdChainIcon,
  ReturnsIcon,
  ShortagesIcon,
  SimulatorIcon,
  AgentIcon,
  ApprovalsIcon,
  AuditIcon,
  SettingsIcon,
} from './components/Icons'
import './App.css'

export type TabType =
  | 'dashboard'
  | 'inventory'
  | 'products'
  | 'customers'
  | 'suppliers'
  | 'purchase_orders'
  | 'dispatches'
  | 'recalls'
  | 'traceability'
  | 'cold_chain'
  | 'returns'
  | 'shortage'
  | 'simulator'
  | 'agent'
  | 'approvals'
  | 'audit'
  | 'settings'

export function App() {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('arogya_theme') || localStorage.getItem('reso_theme')
    return saved === 'light' || saved === 'dark' ? saved : 'light'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('arogya_theme', theme)
  }, [theme])

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))
  }

  const handleAIStatusChange = useCallback((status: AIStatusResponse | null) => {
    setAiStatus(status)
  }, [])

  const [activeTab, setActiveTab] = useState<TabType>('dashboard')
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [healthLoading, setHealthLoading] = useState<boolean>(true)

  const [dashboardSummary, setDashboardSummary] = useState<DashboardSummary | null>(null)
  const [summaryLoading, setSummaryLoading] = useState<boolean>(true)

  const [aiStatus, setAiStatus] = useState<AIStatusResponse | null>(null)
  const [isOfflineModalOpen, setIsOfflineModalOpen] = useState<boolean>(false)
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false)

  const [templates, setTemplates] = useState<TaskTemplate[]>([])
  const [agentPrompt, setAgentPrompt] = useState<string>('Investigate recall Batch B2231 and prepare response options.')
  const [agentRunning, setAgentRunning] = useState<boolean>(false)
  const [activeRun, setActiveRun] = useState<AgentRunDetail | null>(null)
  const [agentError, setAgentError] = useState<string | null>(null)

  const loadInitialData = useCallback(async () => {
    setHealthLoading(true)
    setSummaryLoading(true)

    try {
      const [h, sum, tpls, ai] = await Promise.allSettled([
        fetchHealth(),
        fetchDashboardSummary(),
        fetchAgentTemplates(),
        fetchAIStatus(),
      ])

      if (h.status === 'fulfilled') setHealth(h.value)
      if (sum.status === 'fulfilled') setDashboardSummary(sum.value)
      if (tpls.status === 'fulfilled') setTemplates(tpls.value)
      if (ai.status === 'fulfilled') setAiStatus(ai.value)
    } finally {
      setHealthLoading(false)
      setSummaryLoading(false)
    }
  }, [])

  useEffect(() => {
    loadInitialData()
  }, [loadInitialData])

  const refreshSummary = async () => {
    try {
      const sum = await fetchDashboardSummary()
      setDashboardSummary(sum)
    } catch {
      // ignore
    }
  }

  const handleRunAgent = async (overridePrompt?: string) => {
    const textToRun = (overridePrompt || agentPrompt).trim()
    if (!textToRun) return

    setAgentRunning(true)
    setAgentError(null)

    try {
      const runResult = await runAgentTask(textToRun, 'operations')
      setActiveRun(runResult)
      await refreshSummary()
    } catch (err: unknown) {
      setAgentError(err instanceof Error ? err.message : 'Agent execution failed')
    } finally {
      setAgentRunning(false)
    }
  }

  const handleSelectAttentionItem = (actionPrompt: string) => {
    setAgentPrompt(actionPrompt)
    setActiveTab('agent')
    handleRunAgent(actionPrompt)
  }

  const handleInvestigateBatch = (batchNumber: string) => {
    const p = `Investigate batch ${batchNumber}.`
    setAgentPrompt(p)
    setActiveTab('agent')
    handleRunAgent(p)
  }

  const handleInvestigateProduct = (sku: string) => {
    const p = `Analyze product ${sku} inventory runway, supplier lead time, and recent dispatches.`
    setAgentPrompt(p)
    setActiveTab('agent')
    handleRunAgent(p)
  }

  const handleInvestigateRecall = (batchNumber: string) => {
    const p = `Investigate recall for batch ${batchNumber} and trace affected customer recipients.`
    setAgentPrompt(p)
    setActiveTab('agent')
    handleRunAgent(p)
  }

  const handleInvestigateColdChain = () => {
    const p = 'Investigate cold-chain temperature excursions and affected batches.'
    setAgentPrompt(p)
    setActiveTab('agent')
    handleRunAgent(p)
  }

  const handleInvestigateReturns = () => {
    const p = 'Which batches are expiring in 90 days and what supplier returns can we make?'
    setAgentPrompt(p)
    setActiveTab('agent')
    handleRunAgent(p)
  }

  const handleInvestigateShortages = () => {
    const p = 'Analyze critical drug inventory runway and identify potential shortages.'
    setAgentPrompt(p)
    setActiveTab('agent')
    handleRunAgent(p)
  }

  const handleInspectRunInWorkspace = (run: AgentRunDetail) => {
    setActiveRun(run)
    setAgentPrompt(run.prompt)
    setActiveTab('agent')
  }

  const pendingApprovalsCount = dashboardSummary?.pending_approvals || 0

  return (
    <div className="app-layout">
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onOpenOfflineModelModal={() => setIsOfflineModalOpen(true)}
        mobileOpen={isSidebarOpen}
        onCloseMobile={() => setIsSidebarOpen(false)}
      />

      <div className="app-main-content">
        <Header
          health={health}
          healthLoading={healthLoading}
          aiStatus={aiStatus}
          theme={theme}
          onToggleTheme={toggleTheme}
          onOpenOfflineModelModal={() => setIsOfflineModalOpen(true)}
          onNavigateToSettings={() => setActiveTab('settings')}
          onToggleMobileSidebar={() => setIsSidebarOpen((prev) => !prev)}
        />

        <main className="app-container">
          {/* Navigation Tabs */}
          <nav className="nav-tabs" style={{ overflowX: 'auto', flexWrap: 'nowrap', whiteSpace: 'nowrap' }}>
          <button
            className={`tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            <OverviewIcon size={16} /> Overview
          </button>

          <button
            className={`tab-btn ${activeTab === 'inventory' ? 'active' : ''}`}
            onClick={() => setActiveTab('inventory')}
          >
            <BatchesIcon size={16} /> Batches
          </button>

          <button
            className={`tab-btn ${activeTab === 'products' ? 'active' : ''}`}
            onClick={() => setActiveTab('products')}
          >
            <ProductsIcon size={16} /> Products
          </button>

          <button
            className={`tab-btn ${activeTab === 'customers' ? 'active' : ''}`}
            onClick={() => setActiveTab('customers')}
          >
            <CustomersIcon size={16} /> Customers
          </button>

          <button
            className={`tab-btn ${activeTab === 'suppliers' ? 'active' : ''}`}
            onClick={() => setActiveTab('suppliers')}
          >
            <SuppliersIcon size={16} /> Suppliers
          </button>

          <button
            className={`tab-btn ${activeTab === 'purchase_orders' ? 'active' : ''}`}
            onClick={() => setActiveTab('purchase_orders')}
          >
            <OrdersIcon size={16} /> Purchase Orders
            {dashboardSummary && (dashboardSummary.delayed_purchase_orders || 0) > 0 && (
              <span className="tab-count" style={{ backgroundColor: '#4338ca' }}>
                {dashboardSummary.delayed_purchase_orders}
              </span>
            )}
          </button>

          <button
            className={`tab-btn ${activeTab === 'dispatches' ? 'active' : ''}`}
            onClick={() => setActiveTab('dispatches')}
          >
            <DispatchesIcon size={16} /> Dispatches
          </button>

          <button
            className={`tab-btn ${activeTab === 'recalls' ? 'active' : ''}`}
            onClick={() => setActiveTab('recalls')}
          >
            <RecallsIcon size={16} /> Recalls
            {dashboardSummary && dashboardSummary.active_recalls > 0 && (
              <span className="tab-count" style={{ backgroundColor: '#b91c1c' }}>
                {dashboardSummary.active_recalls}
              </span>
            )}
          </button>

          <button
            className={`tab-btn ${activeTab === 'traceability' ? 'active' : ''}`}
            onClick={() => setActiveTab('traceability')}
          >
            <TraceabilityIcon size={16} /> Traceability
          </button>

          <button
            className={`tab-btn ${activeTab === 'cold_chain' ? 'active' : ''}`}
            onClick={() => setActiveTab('cold_chain')}
          >
            <ColdChainIcon size={16} /> Cold-Chain
            {dashboardSummary && dashboardSummary.cold_chain_exceptions > 0 && (
              <span className="tab-count" style={{ backgroundColor: '#b45309' }}>
                {dashboardSummary.cold_chain_exceptions}
              </span>
            )}
          </button>

          <button
            className={`tab-btn ${activeTab === 'returns' ? 'active' : ''}`}
            onClick={() => setActiveTab('returns')}
          >
            <ReturnsIcon size={16} /> Expiry &amp; Returns
          </button>

          <button
            className={`tab-btn ${activeTab === 'shortage' ? 'active' : ''}`}
            onClick={() => setActiveTab('shortage')}
          >
            <ShortagesIcon size={16} /> Shortages
          </button>

          <button
            className={`tab-btn ${activeTab === 'simulator' ? 'active' : ''}`}
            onClick={() => setActiveTab('simulator')}
            style={activeTab === 'simulator' ? { borderBottomColor: '#6366f1', color: '#c7d2fe' } : undefined}
          >
            <SimulatorIcon size={16} /> What-If Simulator
          </button>

          <button
            className={`tab-btn ${activeTab === 'agent' ? 'active' : ''}`}
            onClick={() => setActiveTab('agent')}
          >
            <AgentIcon size={16} /> Operations Agent
          </button>

          <button
            className={`tab-btn ${activeTab === 'approvals' ? 'active' : ''}`}
            onClick={() => setActiveTab('approvals')}
          >
            <ApprovalsIcon size={16} /> Approval Center
            {pendingApprovalsCount > 0 && (
              <span className="tab-count">{pendingApprovalsCount}</span>
            )}
          </button>

          <button
            className={`tab-btn ${activeTab === 'audit' ? 'active' : ''}`}
            onClick={() => setActiveTab('audit')}
          >
            <AuditIcon size={16} /> Audit Log
          </button>

          <button
            className={`tab-btn ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            <SettingsIcon size={16} /> Settings
          </button>
        </nav>

        {/* Tab Views */}
        {activeTab === 'dashboard' && (
          <OperationsDashboard
            summary={dashboardSummary}
            loading={summaryLoading}
            onSelectAttentionItem={handleSelectAttentionItem}
            onNavigateToApprovals={() => setActiveTab('approvals')}
            onNavigateToTab={(tab) => setActiveTab(tab as TabType)}
            onRefresh={refreshSummary}
          />
        )}

        {activeTab === 'inventory' && (
          <BatchExplorer onInvestigateBatch={handleInvestigateBatch} />
        )}

        {activeTab === 'products' && (
          <ProductCatalogueView onInvestigateProduct={handleInvestigateProduct} />
        )}

        {activeTab === 'customers' && (
          <CustomerManagementView />
        )}

        {activeTab === 'suppliers' && (
          <SupplierManagementView />
        )}

        {activeTab === 'purchase_orders' && (
          <PurchaseOrdersView />
        )}

        {activeTab === 'dispatches' && (
          <DispatchAnalyticsView />
        )}

        {activeTab === 'recalls' && (
          <RecallManagementView
            onInvestigateRecall={handleInvestigateRecall}
            onNavigateToTraceability={() => setActiveTab('traceability')}
          />
        )}

        {activeTab === 'traceability' && (
          <BatchTraceabilityView onInvestigateBatch={handleInvestigateBatch} />
        )}

        {activeTab === 'cold_chain' && (
          <ColdChainView
            summary={dashboardSummary}
            onInvestigateExcursions={handleInvestigateColdChain}
          />
        )}

        {activeTab === 'returns' && (
          <ExpiryReturnsView onInvestigateReturns={handleInvestigateReturns} />
        )}

        {activeTab === 'shortage' && (
          <ShortagePlanningView onInvestigateShortages={handleInvestigateShortages} />
        )}

        {activeTab === 'simulator' && (
          <WhatIfSimulatorView onNavigateToApprovals={() => setActiveTab('approvals')} />
        )}

        {activeTab === 'agent' && (
          <AgentWorkspaceView
            templates={templates}
            prompt={agentPrompt}
            setPrompt={setAgentPrompt}
            onRunAgent={handleRunAgent}
            running={agentRunning}
            activeRun={activeRun}
            error={agentError}
            onNavigateToApprovals={() => setActiveTab('approvals')}
          />
        )}

        {activeTab === 'approvals' && (
          <ApprovalCenterView onApprovalSuccess={refreshSummary} />
        )}

        {activeTab === 'audit' && (
          <AuditLogView onInspectRunInWorkspace={handleInspectRunInWorkspace} />
        )}

        {activeTab === 'settings' && (
          <SettingsView
            health={health}
            healthLoading={healthLoading}
            theme={theme}
            onSetTheme={setTheme}
            onDataReinitialized={loadInitialData}
            onOpenOfflineModelModal={() => setIsOfflineModalOpen(true)}
          />
        )}
      </main>
    </div>

    <OfflineModelRequiredModal
      isOpen={isOfflineModalOpen}
      onClose={() => setIsOfflineModalOpen(false)}
      onStatusChange={handleAIStatusChange}
    />
  </div>
  )
}

export default App
