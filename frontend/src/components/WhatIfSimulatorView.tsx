import { useEffect, useState } from 'react'
import type {
  SimulatorPresetScenario,
  SimulationScenarioRequest,
  SimulationResult,
  SimulationStrategy,
} from '../types/arogya'
import {
  fetchSimulatorScenarios,
  runSimulatorScenario,
  parseSimulatorPrompt,
  explainSimulatorScenario,
  stageSimulatorProposal,
} from '../services/api'

interface WhatIfSimulatorViewProps {
  onNavigateToApprovals: () => void
}

export function WhatIfSimulatorView({ onNavigateToApprovals }: WhatIfSimulatorViewProps) {
  // Preset scenarios
  const [presets, setPresets] = useState<SimulatorPresetScenario[]>([])
  const [selectedPresetId, setSelectedPresetId] = useState<string>('SCEN-RECALL-B2231')

  // Natural Language Prompt State
  const [nlPrompt, setNlPrompt] = useState<string>(
    'What happens if Sun Pharma is delayed by 14 days and hospital ICU demand surges by 25%?'
  )
  const [parsingNl, setParsingNl] = useState<boolean>(false)
  const [explainingAi, setExplainingAi] = useState<boolean>(false)
  const [aiExplanation, setAiExplanation] = useState<string | null>(null)

  // Simulation Form Parameters
  const [scenarioType, setScenarioType] = useState<string>('recall')
  const [batchNumber, setBatchNumber] = useState<string>('B2231')
  const [replacementBatch, setReplacementBatch] = useState<string>('B2232')
  const [demandSurge, setDemandSurge] = useState<number>(0)
  const [supplierDelay, setSupplierDelay] = useState<number>(0)
  const [hospitalPriorityWeight, setHospitalPriorityWeight] = useState<number>(1.5)

  // Simulation State
  const [simulating, setSimulating] = useState<boolean>(false)
  const [simulationResult, setSimulationResult] = useState<SimulationResult | null>(null)
  const [simError, setSimError] = useState<string | null>(null)

  // Proposal Staging State
  const [stagingStrategyId, setStagingStrategyId] = useState<string | null>(null)
  const [stagingSuccess, setStagingSuccess] = useState<{
    runId: string
    proposalIds: number[]
    message: string
  } | null>(null)

  // 1. Load Presets on Mount
  useEffect(() => {
    let mounted = true
    async function loadPresets() {
      try {
        const scens = await fetchSimulatorScenarios()
        if (mounted && scens.length > 0) {
          setPresets(scens)
          // Run default initial simulation for B2231 benchmark
          executeSimulation({
            scenario_type: 'recall',
            batch_number: 'B2231',
            replacement_batch_number: 'B2232',
          })
        }
      } catch (err: unknown) {
        console.error('Failed to load presets:', err)
      }
    }
    loadPresets()
    return () => {
      mounted = false
    }
  }, [])

  // 2. Select Preset Handler
  const handleSelectPreset = (preset: SimulatorPresetScenario) => {
    setSelectedPresetId(preset.id)
    setScenarioType(preset.scenario_type)
    setBatchNumber(preset.batch_number || 'B2231')
    setReplacementBatch(preset.replacement_batch_number || 'B2232')
    setDemandSurge(preset.demand_surge_percent || 0)
    setSupplierDelay(preset.supplier_delay_days || 0)
    setHospitalPriorityWeight(preset.hospital_priority_weight || 1.5)
    setStagingSuccess(null)
    setAiExplanation(null)

    executeSimulation({
      scenario_type: preset.scenario_type,
      batch_number: preset.batch_number,
      replacement_batch_number: preset.replacement_batch_number,
      demand_surge_percent: preset.demand_surge_percent || 0,
      supplier_delay_days: preset.supplier_delay_days || 0,
      hospital_priority_weight: preset.hospital_priority_weight || 1.5,
    })
  }

  // 3. Natural Language Parse Handler
  const handleParsePrompt = async () => {
    if (!nlPrompt.trim()) return
    setParsingNl(true)
    setSimError(null)
    try {
      const res = await parseSimulatorPrompt(nlPrompt)
      const params = res.extracted_parameters
      if (params.scenario_type) setScenarioType(params.scenario_type)
      if (params.batch_number) setBatchNumber(params.batch_number)
      if (params.supplier_delay_days !== undefined) setSupplierDelay(params.supplier_delay_days)
      if (params.demand_surge_percent !== undefined) setDemandSurge(params.demand_surge_percent)
      if (params.hospital_priority_weight !== undefined) setHospitalPriorityWeight(params.hospital_priority_weight)

      // Trigger simulation with extracted params
      executeSimulation({
        scenario_type: params.scenario_type || scenarioType,
        batch_number: params.batch_number || batchNumber,
        replacement_batch_number: replacementBatch,
        demand_surge_percent: params.demand_surge_percent ?? demandSurge,
        supplier_delay_days: params.supplier_delay_days ?? supplierDelay,
        hospital_priority_weight: params.hospital_priority_weight ?? hospitalPriorityWeight,
      })
    } catch (err: unknown) {
      setSimError(err instanceof Error ? err.message : 'Failed to parse natural language scenario')
    } finally {
      setParsingNl(false)
    }
  }

  // 4. AI Explanation Handler
  const handleExplainScenario = async () => {
    setExplainingAi(true)
    try {
      const context = nlPrompt || `Scenario ${scenarioType} for Batch ${batchNumber} with +${demandSurge}% surge.`
      const res = await explainSimulatorScenario(context)
      setAiExplanation(res.explanation)
    } catch (err: unknown) {
      setSimError(err instanceof Error ? err.message : 'Failed to generate AI scenario explanation')
    } finally {
      setExplainingAi(false)
    }
  }

  // 5. Execute Simulation Engine
  const executeSimulation = async (params: SimulationScenarioRequest) => {
    setSimulating(true)
    setSimError(null)
    setStagingSuccess(null)
    try {
      const result = await runSimulatorScenario(params)
      setSimulationResult(result)
    } catch (err: unknown) {
      setSimError(err instanceof Error ? err.message : 'Simulation run failed')
    } finally {
      setSimulating(false)
    }
  }

  // 6. Stage Strategy for Qualified Person Approval
  const handleStageStrategy = async (strat: SimulationStrategy) => {
    if (!simulationResult) return
    setStagingStrategyId(strat.strategy_id)
    try {
      const res = await stageSimulatorProposal({
        simulation_id: simulationResult.simulation_id,
        strategy_id: strat.strategy_id,
        strategy_name: strat.name,
        scenario_name: simulationResult.scenario_name,
        proposals: strat.action_proposals,
      })
      setStagingSuccess({
        runId: res.run_id,
        proposalIds: res.created_proposal_ids,
        message: res.message,
      })
    } catch (err: unknown) {
      setSimError(err instanceof Error ? err.message : 'Failed to stage proposal for approval')
    } finally {
      setStagingStrategyId(null)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', paddingBottom: '3rem' }}>
      {/* 1. Header Banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)',
          border: '1px solid #312e81',
          borderRadius: '12px',
          padding: '1.5rem',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '1.75rem' }}>🔮</span>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0, color: '#f8fafc' }}>
                Arogya AI What-If Supply Chain Simulator
              </h2>
            </div>
            <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.9rem', maxWidth: '850px', lineHeight: 1.5 }}>
              Deterministic, isolated predictive modeling for pharmaceutical disruptions. Model regulatory batch recalls,
              cold-chain thermal excursions, expiring stock, and hospital ICU surges across multi-strategy matrices without
              mutating live inventory or placing unapproved orders.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.4rem' }}>
            <span
              style={{
                backgroundColor: 'rgba(16, 185, 129, 0.15)',
                color: '#10b981',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                padding: '4px 10px',
                borderRadius: '999px',
                fontSize: '0.75rem',
                fontWeight: 600,
                letterSpacing: '0.05em',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
            >
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981' }}></span>
              ISOLATION ENGINE ACTIVE (0 MUTATIONS)
            </span>
            <span style={{ color: '#64748b', fontSize: '0.75rem' }}>
              Qualified Person Gate Enforced
            </span>
          </div>
        </div>

        {/* Clinical Safety Alert Banner */}
        <div
          style={{
            marginTop: '1.25rem',
            backgroundColor: 'rgba(234, 88, 12, 0.1)',
            borderLeft: '4px solid #ea580c',
            borderRadius: '6px',
            padding: '0.75rem 1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
          }}
        >
          <span style={{ fontSize: '1.25rem' }}>🛡️</span>
          <p style={{ margin: 0, fontSize: '0.8rem', color: '#fed7aa', lineHeight: 1.4 }}>
            <strong>Pharmaceutical Safety Mandate:</strong> Arogya AI What-If Simulator provides mathematical, financial,
            and operational inventory projections only. It does not autonomously determine whether medicine is clinically safe
            to administer. Any consequential order or freeze staged here requires human Qualified Person (R.Ph) sign-off.
          </p>
        </div>
      </div>

      {/* 2. Benchmark Preset Selector */}
      <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '10px', padding: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#cbd5e1', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            📌 Benchmark Operational Scenarios & Real Incidents
          </span>
          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Click any card to populate parameters & run model</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.75rem' }}>
          {presets.map((p) => {
            const isSelected = selectedPresetId === p.id
            return (
              <div
                key={p.id}
                onClick={() => handleSelectPreset(p)}
                style={{
                  backgroundColor: isSelected ? '#1e1b4b' : '#0f172a',
                  border: isSelected ? '1.5px solid #6366f1' : '1px solid #334155',
                  borderRadius: '8px',
                  padding: '0.85rem',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease-in-out',
                  position: 'relative',
                  boxShadow: isSelected ? '0 0 12px rgba(99, 102, 241, 0.25)' : 'none',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.35rem' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: isSelected ? '#c7d2fe' : '#e2e8f0' }}>
                    {p.name}
                  </span>
                  {p.benchmark && (
                    <span
                      style={{
                        backgroundColor: '#4338ca',
                        color: '#e0e7ff',
                        fontSize: '0.65rem',
                        fontWeight: 700,
                        padding: '2px 6px',
                        borderRadius: '4px',
                      }}
                    >
                      BENCHMARK
                    </span>
                  )}
                </div>
                <p style={{ margin: 0, fontSize: '0.75rem', color: '#94a3b8', lineHeight: 1.35 }}>
                  {p.description}
                </p>
              </div>
            )
          })}
        </div>
      </div>

      {/* 3. Natural Language Scenario Explorer Console */}
      <div
        style={{
          backgroundColor: '#0f172a',
          border: '1px solid #334155',
          borderRadius: '10px',
          padding: '1.25rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#cbd5e1' }}>
            💬 Natural Language What-If Explorer (Local AI Assisted)
          </label>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
            Deterministic parser extracts entities & sliders; Local AI explains dynamics
          </span>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <input
            type="text"
            value={nlPrompt}
            onChange={(e) => setNlPrompt(e.target.value)}
            placeholder="e.g. What happens if Sun Pharma is delayed by 14 days and hospital ICU demand surges by 25%?"
            style={{
              flex: 1,
              minWidth: '280px',
              backgroundColor: '#1e293b',
              border: '1px solid #475569',
              borderRadius: '6px',
              padding: '0.65rem 0.85rem',
              color: '#f8fafc',
              fontSize: '0.85rem',
            }}
          />
          <button
            onClick={handleParsePrompt}
            disabled={parsingNl}
            style={{
              backgroundColor: '#4f46e5',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              padding: '0.65rem 1rem',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            {parsingNl ? 'Analyzing...' : '⚡ Parse & Tune'}
          </button>
          <button
            onClick={handleExplainScenario}
            disabled={explainingAi}
            style={{
              backgroundColor: '#0284c7',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              padding: '0.65rem 1rem',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            {explainingAi ? 'Explaining...' : '💡 Local AI Briefing'}
          </button>
        </div>

        {aiExplanation && (
          <div
            style={{
              backgroundColor: '#172554',
              border: '1px solid #1e40af',
              borderRadius: '6px',
              padding: '0.85rem 1rem',
              marginTop: '0.25rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
              <span style={{ fontSize: '0.9rem' }}>🤖</span>
              <strong style={{ fontSize: '0.8rem', color: '#93c5fd' }}>Chief Operations Analyst AI Briefing:</strong>
            </div>
            <p style={{ margin: 0, fontSize: '0.8rem', color: '#dbeafe', lineHeight: 1.45 }}>
              {aiExplanation}
            </p>
          </div>
        )}
      </div>

      {/* 4. Interactive Simulation Parameter Tuner Sliders */}
      <div
        style={{
          backgroundColor: '#1e293b',
          border: '1px solid #334155',
          borderRadius: '10px',
          padding: '1.25rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: '#f1f5f9' }}>
            🎛️ Simulation Parameters & Disruption Controls
          </h3>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
            Adjust parameters to recalculate deficits & allocation strategies
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
          {/* Disruption Type */}
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.35rem' }}>
              DISRUPTION TYPE
            </label>
            <select
              value={scenarioType}
              onChange={(e) => setScenarioType(e.target.value)}
              style={{
                width: '100%',
                backgroundColor: '#0f172a',
                border: '1px solid #475569',
                borderRadius: '6px',
                padding: '0.55rem',
                color: '#f8fafc',
                fontSize: '0.85rem',
              }}
            >
              <option value="recall">Batch Regulatory Recall</option>
              <option value="cold_chain_excursion">Cold-Chain Thermal Excursion</option>
              <option value="expiry_risk">Pre-Expiry Stock & RMA Return</option>
              <option value="supplier_delay">Supplier Lead-Time Delay</option>
              <option value="competing_hospital_demand">Hospital ICU Demand Surge</option>
              <option value="warehouse_shortage">Depot Buffer Stockout</option>
            </select>
          </div>

          {/* Target Batch */}
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.35rem' }}>
              TARGET BATCH CODE
            </label>
            <input
              type="text"
              value={batchNumber}
              onChange={(e) => setBatchNumber(e.target.value.toUpperCase())}
              placeholder="e.g. B2231"
              style={{
                width: '100%',
                backgroundColor: '#0f172a',
                border: '1px solid #475569',
                borderRadius: '6px',
                padding: '0.55rem',
                color: '#f8fafc',
                fontSize: '0.85rem',
              }}
            />
          </div>

          {/* Replacement Batch */}
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.35rem' }}>
              REPLACEMENT BATCH (IF RECALL)
            </label>
            <input
              type="text"
              value={replacementBatch}
              onChange={(e) => setReplacementBatch(e.target.value.toUpperCase())}
              placeholder="e.g. B2232"
              style={{
                width: '100%',
                backgroundColor: '#0f172a',
                border: '1px solid #475569',
                borderRadius: '6px',
                padding: '0.55rem',
                color: '#f8fafc',
                fontSize: '0.85rem',
              }}
            />
          </div>

          {/* Demand Surge Slider */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8' }}>
                DEMAND SURGE
              </label>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#38bdf8' }}>
                +{demandSurge}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={demandSurge}
              onChange={(e) => setDemandSurge(Number(e.target.value))}
              style={{ width: '100%', accentColor: '#38bdf8' }}
            />
          </div>

          {/* Supplier Delay Slider */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8' }}>
                SUPPLIER DELAY
              </label>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#f59e0b' }}>
                +{supplierDelay} Days
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="30"
              step="1"
              value={supplierDelay}
              onChange={(e) => setSupplierDelay(Number(e.target.value))}
              style={{ width: '100%', accentColor: '#f59e0b' }}
            />
          </div>

          {/* Hospital Priority Weight Slider */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8' }}>
                HOSPITAL PRIORITY WEIGHT
              </label>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#ec4899' }}>
                {hospitalPriorityWeight.toFixed(1)}x
              </span>
            </div>
            <input
              type="range"
              min="1.0"
              max="5.0"
              step="0.5"
              value={hospitalPriorityWeight}
              onChange={(e) => setHospitalPriorityWeight(Number(e.target.value))}
              style={{ width: '100%', accentColor: '#ec4899' }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
          <button
            onClick={() =>
              executeSimulation({
                scenario_type: scenarioType,
                batch_number: batchNumber,
                replacement_batch_number: replacementBatch,
                demand_surge_percent: demandSurge,
                supplier_delay_days: supplierDelay,
                hospital_priority_weight: hospitalPriorityWeight,
              })
            }
            disabled={simulating}
            style={{
              backgroundColor: '#10b981',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              padding: '0.65rem 1.5rem',
              fontSize: '0.85rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)',
            }}
          >
            {simulating ? 'Calculating Invariants...' : '🚀 Execute What-If Simulation'}
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {simError && (
        <div style={{ backgroundColor: '#7f1d1d', color: '#fecaca', padding: '0.85rem', borderRadius: '8px', fontSize: '0.85rem' }}>
          <strong>Error:</strong> {simError}
        </div>
      )}

      {/* Proposal Staging Feedback Notification */}
      {stagingSuccess && (
        <div
          style={{
            backgroundColor: '#064e3b',
            border: '1px solid #059669',
            borderRadius: '8px',
            padding: '1rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <span style={{ fontSize: '1.1rem' }}>✅</span>
              <strong style={{ color: '#6ee7b7', fontSize: '0.9rem' }}>Proposal Successfully Staged!</strong>
              <span style={{ fontSize: '0.75rem', backgroundColor: '#047857', padding: '2px 6px', borderRadius: '4px', color: '#ecfdf5' }}>
                Run {stagingSuccess.runId}
              </span>
            </div>
            <p style={{ margin: 0, fontSize: '0.8rem', color: '#d1fae5' }}>
              {stagingSuccess.message} Status is <code>pending_review</code>. Stock is protected until authorized.
            </p>
          </div>
          <button
            onClick={onNavigateToApprovals}
            style={{
              backgroundColor: '#10b981',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              padding: '0.55rem 1rem',
              fontSize: '0.85rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Go to Approval Center →
          </button>
        </div>
      )}

      {/* 5. Simulation Results Output */}
      {simulationResult && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Executive Summary Card */}
          <div
            style={{
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '10px',
              padding: '1.25rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span
                  style={{
                    backgroundColor: '#3b82f6',
                    color: '#ffffff',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '4px',
                  }}
                >
                  {simulationResult.simulation_id}
                </span>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc' }}>
                  {simulationResult.scenario_name}
                </h3>
              </div>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Deterministic Model Output</span>
            </div>

            <p style={{ margin: 0, color: '#cbd5e1', fontSize: '0.85rem', lineHeight: 1.5 }}>
              {simulationResult.executive_summary}
            </p>
          </div>

          {/* Baseline vs Disruption Metric Strip */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
            <div style={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px', padding: '1rem' }}>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase' }}>
                {scenarioType === 'recall' ? 'Dispatched Units at Risk' : 'Baseline Stock Units'}
              </span>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f8fafc', marginTop: '0.25rem' }}>
                {simulationResult.baseline.recalled_batch_dispatched_units ??
                  simulationResult.baseline.affected_units_count ??
                  simulationResult.baseline.current_depot_units ??
                  simulationResult.baseline.current_stock ??
                  '—'}
              </div>
              <span style={{ fontSize: '0.7rem', color: '#64748b' }}>Identified outward distribution</span>
            </div>

            <div style={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px', padding: '1rem' }}>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase' }}>
                {scenarioType === 'recall' ? 'Hospital Units (Acute Care)' : 'Hospital Demand'}
              </span>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#38bdf8', marginTop: '0.25rem' }}>
                {simulationResult.baseline.hospital_units_at_risk ??
                  simulationResult.baseline.normal_hospital_demand ??
                  '—'}
              </div>
              <span style={{ fontSize: '0.7rem', color: '#64748b' }}>Life-saving ICU & inpatient priority</span>
            </div>

            <div style={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px', padding: '1rem' }}>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase' }}>
                Eligible Replacement Stock
              </span>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#10b981', marginTop: '0.25rem' }}>
                {simulationResult.baseline.replacement_batch_available_units ??
                  simulationResult.baseline.total_available_stock ??
                  simulationResult.baseline.alternate_depot_units ??
                  '0'}
              </div>
              <span style={{ fontSize: '0.7rem', color: '#64748b' }}>Uncompromised viable lots</span>
            </div>

            <div style={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px', padding: '1rem' }}>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase' }}>
                Forecast Consumption Period
              </span>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#fbbf24', marginTop: '0.25rem' }}>
                {simulationResult.baseline.projected_30d_demand ??
                  simulationResult.baseline.monthly_burn_rate ??
                  '30-Day'}
              </div>
              <span style={{ fontSize: '0.7rem', color: '#64748b' }}>Normal demand during lead-time</span>
            </div>
          </div>

          {/* Strategy Comparison Cards (Side-by-Side) */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#f8fafc' }}>
                ⚖️ Comparative Response Strategies ({simulationResult.strategies.length} Feasible Options)
              </h3>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                Evaluated against fulfillment, clinical hospital protection & cost
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1rem' }}>
              {simulationResult.strategies.map((strat) => {
                const isRecommended = strat.is_recommended
                const isStaging = stagingStrategyId === strat.strategy_id

                return (
                  <div
                    key={strat.strategy_id}
                    style={{
                      backgroundColor: isRecommended ? '#1e1b4b' : '#1e293b',
                      border: isRecommended ? '2px solid #6366f1' : '1px solid #334155',
                      borderRadius: '10px',
                      padding: '1.25rem',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      boxShadow: isRecommended ? '0 4px 20px rgba(99, 102, 241, 0.2)' : 'none',
                      position: 'relative',
                    }}
                  >
                    <div>
                      {/* Strategy Header */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                        <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.05em' }}>
                          {strat.strategy_id}
                        </span>
                        {isRecommended && (
                          <span
                            style={{
                              backgroundColor: '#10b981',
                              color: '#064e3b',
                              fontSize: '0.7rem',
                              fontWeight: 800,
                              padding: '2px 8px',
                              borderRadius: '999px',
                            }}
                          >
                            ★ RECOMMENDED
                          </span>
                        )}
                      </div>

                      <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem', fontWeight: 700, color: '#f8fafc' }}>
                        {strat.name}
                      </h4>

                      <p style={{ margin: '0 0 1rem 0', fontSize: '0.8rem', color: '#cbd5e1', lineHeight: 1.4 }}>
                        {strat.description}
                      </p>

                      {/* Meters Strip */}
                      <div
                        style={{
                          backgroundColor: '#0f172a',
                          borderRadius: '8px',
                          padding: '0.85rem',
                          marginBottom: '1rem',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.6rem',
                        }}
                      >
                        {/* Hospital Fulfillment Meter */}
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.2rem' }}>
                            <span style={{ color: '#94a3b8' }}>Hospital ICU Fulfillment</span>
                            <span style={{ fontWeight: 700, color: strat.hospital_fulfillment_percent >= 90 ? '#10b981' : '#f59e0b' }}>
                              {strat.hospital_fulfillment_percent}%
                            </span>
                          </div>
                          <div style={{ width: '100%', height: '6px', backgroundColor: '#334155', borderRadius: '3px', overflow: 'hidden' }}>
                            <div
                              style={{
                                width: `${Math.min(100, strat.hospital_fulfillment_percent)}%`,
                                height: '100%',
                                backgroundColor: strat.hospital_fulfillment_percent >= 90 ? '#10b981' : '#f59e0b',
                              }}
                            />
                          </div>
                        </div>

                        {/* Retail Chemist Fulfillment Meter */}
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.2rem' }}>
                            <span style={{ color: '#94a3b8' }}>Retail Chemist Allocation</span>
                            <span style={{ fontWeight: 700, color: '#94a3b8' }}>
                              {strat.retail_fulfillment_percent}%
                            </span>
                          </div>
                          <div style={{ width: '100%', height: '6px', backgroundColor: '#334155', borderRadius: '3px', overflow: 'hidden' }}>
                            <div
                              style={{
                                width: `${Math.min(100, strat.retail_fulfillment_percent)}%`,
                                height: '100%',
                                backgroundColor: '#64748b',
                              }}
                            />
                          </div>
                        </div>

                        {/* Financial and Operational Metrics Grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem', marginTop: '0.4rem', paddingTop: '0.4rem', borderTop: '1px solid #1e293b' }}>
                          <div>
                            <span style={{ fontSize: '0.7rem', color: '#64748b' }}>Emergency PO:</span>
                            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f8fafc' }}>
                              {strat.emergency_order_units ?? strat.emergency_po_units ?? 0} units
                            </div>
                          </div>
                          <div>
                            <span style={{ fontSize: '0.7rem', color: '#64748b' }}>Estimated Cost:</span>
                            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#38bdf8' }}>
                              ₹{strat.estimated_cost.toLocaleString()}
                            </div>
                          </div>
                          <div>
                            <span style={{ fontSize: '0.7rem', color: '#64748b' }}>Lead Time:</span>
                            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#fbbf24' }}>
                              {strat.lead_time_days} days
                            </div>
                          </div>
                          <div>
                            <span style={{ fontSize: '0.7rem', color: '#64748b' }}>Projected Runway:</span>
                            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#a78bfa' }}>
                              {strat.projected_runway_days} days
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Pros & Cons */}
                      <div style={{ marginBottom: '1rem', fontSize: '0.75rem', lineHeight: 1.4 }}>
                        <strong style={{ color: '#10b981', display: 'block', marginBottom: '0.2rem' }}>Advantages:</strong>
                        <ul style={{ margin: '0 0 0.5rem 1.25rem', padding: 0, color: '#cbd5e1' }}>
                          {strat.pros.map((p, idx) => (
                            <li key={idx}>{p}</li>
                          ))}
                        </ul>

                        <strong style={{ color: '#f87171', display: 'block', marginBottom: '0.2rem' }}>Operational Trade-Offs:</strong>
                        <ul style={{ margin: '0 0 0.5rem 1.25rem', padding: 0, color: '#94a3b8' }}>
                          {strat.cons.map((c, idx) => (
                            <li key={idx}>{c}</li>
                          ))}
                        </ul>
                      </div>

                      {/* Associated Proposals count */}
                      <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '1rem' }}>
                        Includes <strong>{strat.action_proposals.length} Action Proposals</strong> (Requires QP Approval)
                      </div>
                    </div>

                    {/* Stage Proposal Action Button */}
                    <button
                      onClick={() => handleStageStrategy(strat)}
                      disabled={isStaging}
                      style={{
                        width: '100%',
                        backgroundColor: isRecommended ? '#6366f1' : '#334155',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '0.65rem 1rem',
                        fontSize: '0.85rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        transition: 'background-color 0.15s ease',
                      }}
                    >
                      {isStaging ? 'Staging Plan...' : 'Stage Proposal for Approval →'}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Assumptions & Evidence Audit Strip */}
          <div
            style={{
              backgroundColor: '#0f172a',
              border: '1px solid #334155',
              borderRadius: '10px',
              padding: '1.25rem',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '1rem',
            }}
          >
            <div>
              <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', fontWeight: 600, color: '#e2e8f0' }}>
                📋 Mathematical & Operational Assumptions
              </h4>
              <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.75rem', color: '#94a3b8', lineHeight: 1.45 }}>
                {simulationResult.assumptions.map((a, idx) => (
                  <li key={idx}>{a}</li>
                ))}
              </ul>
            </div>

            <div>
              <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', fontWeight: 600, color: '#e2e8f0' }}>
                ⚠️ Missing Telemetry & Data Boundaries
              </h4>
              <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.75rem', color: '#94a3b8', lineHeight: 1.45 }}>
                {simulationResult.missing_data.map((m, idx) => (
                  <li key={idx}>{m}</li>
                ))}
              </ul>
            </div>

            <div>
              <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', fontWeight: 600, color: '#e2e8f0' }}>
                🔒 Audit Ledger Invariant Notice
              </h4>
              <p style={{ margin: 0, fontSize: '0.75rem', color: '#94a3b8', lineHeight: 1.45 }}>
                {simulationResult.clinical_safety_notice}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
