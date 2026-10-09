import { useCallback, useEffect, useState } from 'react'
import type { HealthResponse } from './types/workflow'
import type { DashboardSummary, AgentRunDetail, TaskTemplate } from './types/arogya'
import {
  fetchHealth,
  fetchDashboardSummary,
  fetchAgentTemplates,
  runAgentTask,
  resetDemoData,
} from './services/api'
import { Header } from './components/Header'
import { OperationsDashboard } from './components/OperationsDashboard'
import { BatchExplorer } from './components/BatchExplorer'
import { AgentWorkspaceView } from './components/AgentWorkspaceView'
import { ApprovalCenterView } from './components/ApprovalCenterView'
import './App.css'

export function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'inventory' | 'agent' | 'approvals'>('dashboard')
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [healthLoading, setHealthLoading] = useState<boolean>(true)
  const [resetting, setResetting] = useState<boolean>(false)

  const [dashboardSummary, setDashboardSummary] = useState<DashboardSummary | null>(null)
  const [summaryLoading, setSummaryLoading] = useState<boolean>(true)

  const [templates, setTemplates] = useState<TaskTemplate[]>([])
  const [agentPrompt, setAgentPrompt] = useState<string>('Investigate recall Batch B2231.')
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

  const handleResetDemo = async () => {
    setResetting(true)
    try {
      await resetDemoData()
      setActiveRun(null)
      await loadInitialData()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Reset failed')
    } finally {
      setResetting(false)
    }
  }

  const handleRunAgent = async (overridePrompt?: string) => {
    const textToRun = (overridePrompt || agentPrompt).trim()
    if (!textToRun) return

    setAgentRunning(true)
    setAgentError(null)

    try {
      const runResult = await runAgentTask(textToRun, 'demo')
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

  const handleInvestigateBatchFromExplorer = (batchNumber: string) => {
    const p = `Investigate batch ${batchNumber}.`
    setAgentPrompt(p)
    setActiveTab('agent')
    handleRunAgent(p)
  }

  const pendingApprovalsCount = dashboardSummary?.pending_approvals || 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Header
        health={health}
        healthLoading={healthLoading}
        onResetDemo={handleResetDemo}
        resetting={resetting}
      />

      <main className="app-container">
        {/* Navigation Tabs */}
        <nav className="nav-tabs">
          <button
            className={`tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            📊 Operations Dashboard
          </button>

          <button
            className={`tab-btn ${activeTab === 'inventory' ? 'active' : ''}`}
            onClick={() => setActiveTab('inventory')}
          >
            📦 Inventory & Batch Explorer
          </button>

          <button
            className={`tab-btn ${activeTab === 'agent' ? 'active' : ''}`}
            onClick={() => setActiveTab('agent')}
          >
            🤖 Agent Workspace
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
          <BatchExplorer onInvestigateBatch={handleInvestigateBatchFromExplorer} />
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
      </main>
    </div>
  )
}

export default App

