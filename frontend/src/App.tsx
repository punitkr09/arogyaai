import { useCallback, useEffect, useState } from 'react'
import type { HealthResponse } from './types/workflow'
import type { DashboardSummary, AgentRunDetail, TaskTemplate } from './types/arogya'
import {
  fetchHealth,
  fetchDashboardSummary,
  fetchAgentTemplates,
  runAgentTask,
} from './services/api'
import { Header } from './components/Header'
import { OperationsDashboard } from './components/OperationsDashboard'
import { BatchExplorer } from './components/BatchExplorer'
import { BatchTraceabilityView } from './components/BatchTraceabilityView'
import { ColdChainView } from './components/ColdChainView'
import { ExpiryReturnsView } from './components/ExpiryReturnsView'
import { ShortagePlanningView } from './components/ShortagePlanningView'
import { AgentWorkspaceView } from './components/AgentWorkspaceView'
import { ApprovalCenterView } from './components/ApprovalCenterView'
import { WhatIfSimulatorView } from './components/WhatIfSimulatorView'
import { AuditLogView } from './components/AuditLogView'
import { SettingsView } from './components/SettingsView'
import './App.css'

type TabType =
  | 'dashboard'
  | 'inventory'
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
  const [activeTab, setActiveTab] = useState<TabType>('dashboard')
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [healthLoading, setHealthLoading] = useState<boolean>(true)

  const [dashboardSummary, setDashboardSummary] = useState<DashboardSummary | null>(null)
  const [summaryLoading, setSummaryLoading] = useState<boolean>(true)

  const [templates, setTemplates] = useState<TaskTemplate[]>([])
  const [agentPrompt, setAgentPrompt] = useState<string>('Investigate recall Batch B2231 and prepare response options.')
  const [agentRunning, setAgentRunning] = useState<boolean>(false)
  const [activeRun, setActiveRun] = useState<AgentRunDetail | null>(null)
  const [agentError, setAgentError] = useState<string | null>(null)

  const loadInitialData = useCallback(async () => {
    setHealthLoading(true)
    setSummaryLoading(true)

    try {
      const [h, sum, tpls] = await Promise.allSettled([
        fetchHealth(),
        fetchDashboardSummary(),
        fetchAgentTemplates(),
      ])

      if (h.status === 'fulfilled') setHealth(h.value)
      if (sum.status === 'fulfilled') setDashboardSummary(sum.value)
      if (tpls.status === 'fulfilled') setTemplates(tpls.value)
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
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Header
        health={health}
        healthLoading={healthLoading}
        onNavigateToSettings={() => setActiveTab('settings')}
      />

      <main className="app-container">
        {/* Navigation Tabs */}
        <nav className="nav-tabs" style={{ overflowX: 'auto', flexWrap: 'nowrap', whiteSpace: 'nowrap' }}>
          <button
            className={`tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            📊 Overview
          </button>

          <button
            className={`tab-btn ${activeTab === 'inventory' ? 'active' : ''}`}
            onClick={() => setActiveTab('inventory')}
          >
            📦 Inventory & Batches
          </button>

          <button
            className={`tab-btn ${activeTab === 'traceability' ? 'active' : ''}`}
            onClick={() => setActiveTab('traceability')}
          >
            🔍 Batch Traceability
          </button>

          <button
            className={`tab-btn ${activeTab === 'cold_chain' ? 'active' : ''}`}
            onClick={() => setActiveTab('cold_chain')}
          >
            ❄️ Cold-Chain Monitor
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
            ⏳ Expiry & Returns
          </button>

          <button
            className={`tab-btn ${activeTab === 'shortage' ? 'active' : ''}`}
            onClick={() => setActiveTab('shortage')}
          >
            📉 Shortage Planning
          </button>

          <button
            className={`tab-btn ${activeTab === 'simulator' ? 'active' : ''}`}
            onClick={() => setActiveTab('simulator')}
            style={activeTab === 'simulator' ? { borderBottomColor: '#6366f1', color: '#c7d2fe' } : undefined}
          >
            🔮 What-If Simulator
          </button>

          <button
            className={`tab-btn ${activeTab === 'agent' ? 'active' : ''}`}
            onClick={() => setActiveTab('agent')}
          >
            🤖 Operations Agent
          </button>

          <button
            className={`tab-btn ${activeTab === 'approvals' ? 'active' : ''}`}
            onClick={() => setActiveTab('approvals')}
          >
            ⚖️ Approval Center
            {pendingApprovalsCount > 0 && (
              <span className="tab-count">{pendingApprovalsCount}</span>
            )}
          </button>

          <button
            className={`tab-btn ${activeTab === 'audit' ? 'active' : ''}`}
            onClick={() => setActiveTab('audit')}
          >
            📜 Audit Log
          </button>

          <button
            className={`tab-btn ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            ⚙️ Settings
          </button>
        </nav>

        {/* Tab Views */}
        {activeTab === 'dashboard' && (
          <OperationsDashboard
            summary={dashboardSummary}
            loading={summaryLoading}
            onSelectAttentionItem={handleSelectAttentionItem}
            onNavigateToApprovals={() => setActiveTab('approvals')}
          />
        )}

        {activeTab === 'inventory' && (
          <BatchExplorer onInvestigateBatch={handleInvestigateBatch} />
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
            onDataReinitialized={loadInitialData}
          />
        )}
      </main>
    </div>
  )
}

export default App
