# Arogya AI — Pharmaceutical Inventory Intelligence & Autonomous Operations Agent 🏥💊

An enterprise-grade, agentic operations control platform and clinical supply-chain decision-support system engineered for high-consequence pharmaceutical distribution (critical antibiotics, emergency care injectables, and thermo-labile cold-chain biologics).

Arogya AI unites a real-time **Operations Control Centre** with an **Intelligent Decision-Support Engine**: it investigates regulatory batch recalls, maps forward and reverse customer exposure across hospital ICUs and retail chemist chains, reconciles physical warehouse inventory against dispatch ledgers, monitors IoT cold-chain sensor breaches, audits pre-expiry stock against contractual supplier return windows, executes independent deterministic mathematical verifications, and enforces strict human **Qualified Person (R.Ph / QP)** approval gates before executing state-mutating actions.

Furthermore, Arogya AI features the **What-If Supply Chain Simulator** — an isolated, deterministic predictive sandbox that models recalls, thermal excursions, supplier delays, and acute hospital demand surges across multi-strategy comparative matrices with zero live ledger mutation risk.

---

## Table of Contents
1. [Executive Summary & Core Differentiators](#1-executive-summary--core-differentiators)
2. [End-to-End System Architecture](#2-end-to-end-system-architecture)
3. [The 7-Stage Cognitive Reasoning Loop](#3-the-7-stage-cognitive-reasoning-loop)
4. [Backend Architecture & Component Directory](#4-backend-architecture--component-directory)
   - [Database Schema & Relational Models (`db_models.py`)](#41-database-schema--relational-models-db_modelspy)
   - [Configuration & Environment Management (`config.py`)](#42-configuration--environment-management-configpy)
   - [AI Inference & Semantic Fallback Layer (`ai_provider.py`)](#43-ai-inference--semantic-fallback-layer-ai_providerpy)
   - [Autonomous Agent Orchestrator (`orchestrator.py`)](#44-autonomous-agent-orchestrator-orchestratorpy)
   - [Deterministic Application Tool Registry (`registry.py`)](#45-deterministic-application-tool-registry-registrypy)
   - [What-If Supply Chain Simulation Engine (`engine.py`)](#46-what-if-supply-chain-simulation-engine-enginepy)
   - [REST API Route Handlers (`routers/`)](#47-rest-api-route-handlers-routers)
   - [Full Pharmaceutical Distribution Dataset Integration (`07_pharma_distribution.zip`)](#48-full-pharmaceutical-distribution-dataset-integration-07_pharma_distributionzip)
   - [Operational Data Ingestion via Agent Workspace & GDP Guardrails](#49-operational-data-ingestion-via-agent-workspace--gdp-guardrails)
5. [Frontend Operations Control Centre](#5-frontend-operations-control-centre)
   - [Design System & Navigation Shell (`App.tsx`)](#51-design-system--navigation-shell-apptsx)
   - [View Components Directory (`components/`)](#52-view-components-directory-components)
   - [Type Definitions & API Client Service](#53-type-definitions--api-client-service)
6. [What-If Supply Chain Simulator (Standout Feature)](#6-what-if-supply-chain-simulator-standout-feature)
   - [Zero Live Mutation Sandbox](#61-zero-live-mutation-sandbox)
   - [Disruption Scenarios Modeled](#62-disruption-scenarios-modeled)
   - [Multi-Strategy Comparison Matrix](#63-multi-strategy-comparison-matrix)
   - [Local AI Interpretation & Qualified Person Staging](#64-local-ai-interpretation--qualified-person-staging)
7. [Safety Barriers, Governance & Compliance Controls](#7-safety-barriers-governance--compliance-controls)
8. [Complete REST API Reference](#8-complete-rest-api-reference)
9. [Automated Verification Suite & Test Report](#9-automated-verification-suite--test-report)
10. [Installation, Configuration & Operational Guide](#10-installation-configuration--operational-guide)
11. [Production Deployment Guide (Vercel + Render / Cloud)](#11-production-deployment-guide-vercel--render--cloud)
   - [11.1 Deployment Architecture: Why Frontend on Vercel & Backend on Render](#111-deployment-architecture-why-frontend-on-vercel--backend-on-render)
   - [11.2 Frontend Deployment on Vercel (Step-by-Step)](#112-frontend-deployment-on-vercel-step-by-step)
   - [11.3 Backend Deployment on Render (Step-by-Step)](#113-backend-deployment-on-render-step-by-step)
   - [11.4 Database Persistence: SQLite vs Managed PostgreSQL](#114-database-persistence-sqlite-vs-managed-postgresql)
   - [11.5 AI Model & Offline Model Required Behavior](#115-ai-model--offline-model-required-behavior)
   - [11.6 Complete Production Environment Variables Reference](#116-complete-production-environment-variables-reference)
   - [11.7 Pre-Flight & Post-Deployment Verification Checklist](#117-pre-flight--post-deployment-verification-checklist)
   - [11.8 Updating the Live Application via GitHub](#118-updating-the-live-application-via-github)

---

## 1. Executive Summary & Core Differentiators

Modern pharmaceutical distribution operates under strict regulatory frameworks (Good Distribution Practice - GDP, FDA 21 CFR Part 11, CDSCO regulations) where inventory errors directly impact human lives:
- Dispensing a contaminated or recalled antibiotic can lead to patient mortality.
- Injecting thermally degraded biological proteins (e.g., Insulin) causes clinical treatment failure.
- Miscalculating hospital replacement buffers during an active recall deprives emergency ICU patients of life-saving therapy.
- Missing contractual supplier return windows results in massive financial write-offs.

Arogya AI addresses these operational challenges through key architectural principles:

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                             CORE SYSTEM PRINCIPLES                               │
├─────────────────────────┬──────────────────────────┬─────────────────────────────┤
│ 1. REAL PERSISTENCE     │ 2. DETERMINISTIC MATH    │ 3. HUMAN APPROVAL GATES     │
│ Zero mock simulations.  │ Critical metrics (DoC,   │ AI proposes, humans decide. │
│ Live SQLite relational  │ deficits, MOQ compliance)│ State mutations (freezes,   │
│ schema with absolute    │ are calculated by exact  │ orders, transfers) require  │
│ paths and ledger audits.│ deterministic functions. │ Qualified Person (R.Ph) auth│
├─────────────────────────┼──────────────────────────┼─────────────────────────────┤
│ 4. OFFLINE LOCAL AI     │ 5. WHAT-IF SIMULATOR     │ 6. AUTOMATED INVARIANTS     │
│ Runs locally on Ollama  │ Isolated predictive      │ Independent verification    │
│ (qwen2.5-coder:7b) with │ sandbox modeling shocks  │ re-queries raw DB tables    │
│ zero-token semantic     │ across multi-strategy    │ before and during every     │
│ deterministic fallback. │ comparative matrices.    │ consequential workflow.     │
└─────────────────────────┴──────────────────────────┴─────────────────────────────┘
```

---

## 2. End-to-End System Architecture

Arogya AI is structured into two deeply integrated operational layers:
- **Layer A — Operations Control Centre (Frontend)**: Real-time graphical dashboard where staff monitor active recalls, investigate batch chain-of-custody, track IoT cold-chain temperatures, audit expiring stock, simulate what-if disruptions, review agent reasoning dossiers, and authorize action proposals.
- **Layer B — Intelligent Decision-Support Engine (Backend)**: FastAPI application orchestrating local AI inference, deterministic mathematical tools, invariant checkers, and SQLite persistence.

```
                                  OPERATIONS CONTROL CENTRE (REACT 19 + VITE)
  ┌─────────────────────────────────────────────────────────────────────────────────────────────────────┐
  │  📊 Overview Dashboard  │  📦 Inventory & Batches  │  🔍 Traceability  │  ❄️ Cold-Chain Monitor      │
  │  ⏳ Expiry & Returns    │  📉 Shortage Planning    │  🔮 What-If Simulator │  🤖 Agent Workspace     │
  │  ⚖️ Approval Center (QP) │  📜 Audit Ledger Log     │  ⚙️ System Settings & Governance              │
  └─────────────────────────────────────────────────────────────────────────────────────────────────────┘
                                                    │
                                        HTTP / JSON REST API (PORT 8000)
                                                    │
                                                    ▼
                                   FASTAPI APPLICATION LAYER (PYTHON 3.10+)
  ┌─────────────────────────────────────────────────────────────────────────────────────────────────────┐
  │  • /api/dashboard      • /api/inventory       • /api/agent        • /api/approvals                  │
  │  • /api/simulator      • /api/health          • /api/demo         • /api/workflow                   │
  └─────────────────────────────────────────────────────────────────────────────────────────────────────┘
                                                    │
                     ┌──────────────────────────────┴──────────────────────────────┐
                     ▼                                                             ▼
       INTELLIGENT REASONING ENGINE                                  ISOLATED WHAT-IF SIMULATOR
  ┌─────────────────────────────────────┐                       ┌─────────────────────────────────────┐
  │ • Agent Orchestrator                │                       │ • WhatIfSimulatorEngine             │
  │ • 7-Stage Cognitive Loop            │                       │ • Zero-Commit Read-Only Sandbox     │
  │ • Local Ollama (qwen2.5-coder:7b)   │                       │ • 6 Disruption Scenario Models      │
  │ • Deterministic Semantic Fallback   │                       │ • Multi-Strategy Matrix Generator   │
  │ • Entity & Temporal Parser          │                       │ • Automated Parameter Tuning        │
  └─────────────────────────────────────┘                       └─────────────────────────────────────┘
                     │                                                             │
                     └──────────────────────────────┬──────────────────────────────┘
                                                    │
                                                    ▼
                                   DETERMINISTIC APPLICATION TOOLS & INVARIANTS
  ┌─────────────────────────────────────────────────────────────────────────────────────────────────────┐
  │ • trace_batch_recipients            • calculate_replacement_coverage    • calculate_shortage_risk   │
  │ • get_temperature_excursions       • calculate_supplier_return_window  • compare_options           │
  │ • verify_operational_invariants     • validate_and_execute_proposal     • get_attention_items       │
  └─────────────────────────────────────────────────────────────────────────────────────────────────────┘
                                                    │
                                                    ▼
                                  SAFETY BARRIER & GOVERNANCE GATES
  ┌─────────────────────────────────────────────────────────────────────────────────────────────────────┐
  │ [GATE 1] Outward Dispatch Hard Barrier (HTTP 403 on Quarantined / Recalled Stock)                   │
  │ [GATE 2] Qualified Person (R.Ph / QP) Approval Sign-Off Gate for Consequential State Mutations      │
  │ [GATE 3] Pre-Execution Deterministic Invariant Re-Assertion on Live Relational Ledger               │
  └─────────────────────────────────────────────────────────────────────────────────────────────────────┘
                                                    │
                                                    ▼
                                  SQLITE CANONICAL RELATIONAL DATABASE
  ┌─────────────────────────────────────────────────────────────────────────────────────────────────────┐
  │ Products • Batches • Stock Movements • Customers • Dispatches • Suppliers • Purchase Orders        │
  │ Sensor Logs • Incidents • Agent Runs • Agent Events • Action Proposals • Approval Decisions         │
  └─────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

### 2.1 Hybrid Deployment Topology: Public Web + User Workstation

Arogya AI combines a publicly deployed operations platform with private local AI inference running directly on the user's workstation. Cloud-hosted AI models are **not** required; when local AI is unavailable, the system automatically falls back to deterministic operations backed by canonical pharmaceutical datasets.

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                       PUBLIC CLOUD INFRASTRUCTURE                                      │
├─────────────────────────────────────────────────┬──────────────────────────────────────────────────────┤
│               VERCEL EDGE NETWORK               │                    RENDER WEB SERVICE                │
│       https://arogya-ai.vercel.app              │             https://arogya-ai.onrender.com           │
│                                                 │                                                      │
│  ┌───────────────────────────────────────────┐  │  ┌────────────────────────────────────────────────┐  │
│  │ React 19 + Vite 8 SPA Dashboard           │  │  │ FastAPI Application Layer                      │  │
│  │ • 10 Operational Views & Workspaces       │──┼──┼─▶ • REST Endpoints (/api/dashboard, /inventory)│  │
│  │ • Local AI Connection Layer (7 States)    │  │  │ • Agent Orchestrator & Invariant Verifier      │  │
│  │ • Dual-Mode UI Indicators & Badges        │  │  │ • Qualified Person (QP) Approval Gates         │  │
│  │ • Deterministic Fallback UI               │  │  │ • Persistent SQLite / PostgreSQL Engine        │  │
│  └───────────────────────────────────────────┘  │  └────────────────────────────────────────────────┘  │
└──────────────────────┬──────────────────────────┴──────────────────────────┬───────────────────────────┘
                       │                                                     │
                       │ (Browser-to-Localhost)                              │ (Database Queries & State)
                       ▼                                                     ▼
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                    USER WORKSTATION (LOCAL MACHINE)                                    │
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                        │
│   [MODE A: LOCAL AI ACTIVE]                                  [MODE B: DATASET FALLBACK ACTIVE]         │
│                                                                                                        │
│   Direct Local Check or Companion Proxy                      Zero AI Dependency                        │
│   ┌─────────────────────────────────────────┐                ┌──────────────────────────────────────┐  │
│   │ Option 1: Native Ollama Service         │                │ Built-in SQLite Relational Database  │  │
│   │ http://127.0.0.1:11434                  │                │ • 75 Master Products                 │  │
│   │ • Model: qwen2.5-coder:7b               │                │ • 338 Physical Batches               │  │
│   │ • Endpoints: /api/tags, /api/chat       │                │ • 420 Healthcare Accounts            │  │
│   │ • 100% Private, Zero Cloud Tokens       │                │ • 5,174 Forward Dispatches           │  │
│   └─────────────────────────────────────────┘                │ • 75 Suppliers & PO Ledgers          │  │
│                       ▲                                      │ • IoT Cold-Chain Sensor Telemetry    │  │
│                       │ (Local Loopback)                     │ • Predefined Deterministic Queries   │  │
│   ┌───────────────────┴─────────────────────┐                │ • 100% Functional Without LLM        │  │
│   │ Option 2: Arogya Companion Helper       │                └──────────────────────────────────────┘  │
│   │ http://127.0.0.1:11435                  │                                                          │
│   │ • Loopback-bound Python HTTP proxy      │                                                          │
│   │ • CORS & Private Network Access (PNA)   │                                                          │
│   │ • Optional TLS: python companion --ssl  │                                                          │
│   └─────────────────────────────────────────┘                                                          │
└────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

### 2.2 Dual Operational Modes: Mode A (Local AI) vs Mode B (Dataset Fallback)

Arogya AI operates deterministically in two transparent modes. It **never** pretends an AI model is running when it is not, and it **never** hallucinates inventory quantities or completed actions:

| Dimension | Mode A — Local AI Available | Mode B — Dataset Fallback Active |
|---|---|---|
| **Trigger Condition** | Ollama reachable on `127.0.0.1:11434` (or Companion `127.0.0.1:11435`) **AND** `qwen2.5-coder:7b` is installed. | Ollama unreachable, model not pulled, or browser security blocks local connection. |
| **Header Badge** | `AI: Local — Connected` & `Model: qwen2.5-coder:7b` & `Mode: Local AI` | `AI: Offline` & `Mode: Dataset Fallback` |
| **Workspace Banner** | Green banner indicating local model active with zero cloud token usage. | Amber banner indicating dataset fallback active with manual retry button. |
| **Inference Source** | Local user workstation via Ollama API (`/api/chat`). | Local semantic entity extractor & deterministic database functions. |
| **Dossier Distinction** | Tagged: `[AI-Generated Reasoning — qwen2.5-coder:7b (Local Ollama)]` | Tagged: `[Dataset-Backed Deterministic Output — Verified Database Records]` |
| **Database Operations** | Verified against live SQLite database; invariants re-checked. | Identical live SQLite database; 100% metric and audit availability. |
| **Consequential Actions** | Proposes staged actions (`pending_review`); requires QP approval. | Proposes staged actions (`pending_review`); requires QP approval. |
| **External Privacy** | **Zero private hospital or patient records leave the user's machine.** | **Zero private records leave the system.** |

---

### 2.3 The 7-State Local AI Connection Machine

The frontend connection layer ([`frontend/src/services/localAiService.ts`](file:///home/phoolghobhi/agentic-hackathon/frontend/src/services/localAiService.ts)) implements a deterministic 7-state finite state machine with automatic background polling (30s intervals with exponential backoff on failure) and immediate manual retry:

```mermaid
stateDiagram-v2
    [*] --> CheckingLocalAI : Page Load / Reconnect Click

    CheckingLocalAI --> LocalAIConnected : Ollama online AND qwen2.5-coder:7b found
    CheckingLocalAI --> ModelMissing : Ollama online BUT qwen2.5-coder:7b missing
    CheckingLocalAI --> BrowserBlocked : Mixed Content / PNA blocked by browser
    CheckingLocalAI --> OllamaOffline : Connection refused / timeout / companion offline
    CheckingLocalAI --> RequestFailed : Network error / malformed response

    ModelMissing --> CheckingLocalAI : Retry / User pulls model
    BrowserBlocked --> CheckingLocalAI : Retry / User starts Companion
    OllamaOffline --> CheckingLocalAI : Retry / User starts Ollama
    RequestFailed --> CheckingLocalAI : Manual Retry

    ModelMissing --> DatasetFallbackActive : Auto-activated
    BrowserBlocked --> DatasetFallbackActive : Auto-activated
    OllamaOffline --> DatasetFallbackActive : Auto-activated
    RequestFailed --> DatasetFallbackActive : Auto-activated

    DatasetFallbackActive --> CheckingLocalAI : User clicks "Retry Local AI Connection"
```

1. **`Checking local AI`**: Probes native Ollama (`GET /api/tags`) and Companion (`GET /health`) with a 3.5s timeout.
2. **`Local AI connected`**: Both Ollama and `qwen2.5-coder:7b` are verified. Mode A enabled.
3. **`Model missing`**: Ollama is running, but the configured model is missing. Guides user to run `ollama pull qwen2.5-coder:7b`.
4. **`Ollama not installed or not running`**: Port 11434 unreachable. Mode B activated.
5. **`Local connection blocked by browser security`**: HTTPS browser blocks direct HTTP loopback. Prompts user to start the Arogya Companion Helper (`python3 scripts/arogya_companion.py`).
6. **`Local AI request failed`**: Transient inference failure or dropped connection.
7. **`Dataset fallback active`**: Safe fallback operational state where all dataset queries and tools run deterministically.

---

### 2.4 Browser Security, Private Network Access (PNA) & The Arogya Companion Helper

When a website is hosted on a secure public origin (such as Vercel: `https://arogya-ai.vercel.app`), modern web browsers enforce strict security boundaries:
1. **Mixed Content Restrictions**: Modern browsers prevent secure HTTPS web pages from making unencrypted HTTP requests to `http://127.0.0.1:11434`.
2. **Private Network Access (PNA)**: Chromium browsers send a preflight request (`Access-Control-Request-Private-Network: true`) when a public webpage attempts to contact private IP addresses (`127.0.0.1`).
3. **CORS Restrictions**: Standard Ollama does not include wildcards or production Vercel origins in its default `Access-Control-Allow-Origin` headers.

#### How Arogya AI Solves This Securely:
- **No Insecure Recommendations**: Arogya AI **never** asks users to disable browser security flags or expose Ollama to `0.0.0.0`.
- **Direct Check First**: In environments where direct access succeeds (local development on `http://localhost:5173` or browsers with PNA policies configured), direct native Ollama communication is used.
- **Arogya Companion Helper (`scripts/arogya_companion.py`)**: A lightweight, zero-dependency Python script running locally on the user's workstation:
  - Strictly binds to loopback (`127.0.0.1:11435`).
  - Implements origin validation allowing only local dev origins and `https://*.vercel.app`.
  - Responds to PNA preflights with `Access-Control-Allow-Private-Network: true`.
  - Proxies inference requests directly to local Ollama on `127.0.0.1:11434`.
  - Supports self-signed TLS via `--ssl` for environments enforcing HTTPS-to-HTTPS loopback communication.
  - Zero external packages required (uses Python standard library: `http.server`, `urllib.request`, `ssl`).

---

## 3. The 7-Stage Cognitive Reasoning Loop

Every natural language operational query or incident investigation runs through a deterministic 7-stage cognitive loop implemented in [`backend/app/agent/orchestrator.py`](file:///home/phoolghobhi/agentic-hackathon/backend/app/agent/orchestrator.py):

```mermaid
sequenceDiagram
    autonumber
    actor Operator as Operations Pharmacist
    participant Orch as Agent Orchestrator
    participant AI as Local AI / Semantic Engine
    participant Tools as Deterministic Tools
    participant Invar as Invariant Verifier
    participant DB as SQLite Database
    participant Gate as QP Approval Gate

    Operator->>Orch: Submit natural language query ("Investigate recall Batch B2231")
    Note over Orch: Stage 1: INTAKE & CLASSIFICATION
    Orch->>AI: Extract entities (Batch B2231, intent: recall, scope: full trace)
    AI-->>Orch: Structured Intent: {action: "investigate", batch: "B2231", type: "recall"}
    
    Note over Orch: Stage 2: DETERMINISTIC PLANNING
    Orch->>Orch: Select diagnostic tools (trace_recipients, inventory, replacement_coverage)
    
    Note over Orch: Stage 3: TOOL EXECUTION
    Orch->>Tools: Call trace_batch_recipients(batch_number="B2231")
    Tools->>DB: Query dispatches, customers, priority tiers
    DB-->>Tools: 640 dispatched (Hospitals: 390, Retail: 250)
    Orch->>Tools: Call calculate_replacement_coverage("B2231", "B2232")
    Tools->>DB: Query alternative lots, supplier MOQ, 30d burn rate
    DB-->>Tools: Replacement deficit: 600 units, PO needed: 600 units
    
    Note over Orch: Stage 4: SYNTHESIS & ANALYSIS
    Orch->>AI: Analyze facts, generate comparative options (Hospital Defense vs Pro-Rata)
    AI-->>Orch: Evidence-backed clinical trade-off analysis
    
    Note over Orch: Stage 5: INDEPENDENT VERIFICATION
    Orch->>Invar: Verify invariants directly on raw DB tables
    Invar->>DB: Re-assert sum(dispatches), balance isolation, MOQ compliance
    DB-->>Invar: All invariants verified (100% Passed)
    Invar-->>Orch: Invariant verification proofs recorded
    
    Note over Orch: Stage 6: HUMAN APPROVAL GATE
    Orch->>Gate: Stage ActionProposal records (status: pending_review)
    Gate->>DB: Persist ActionProposal & AgentRun (Zero stock mutation yet!)
    
    Note over Orch: Stage 7: REPORTING & DOSSIER
    Orch-->>Operator: Complete execution dossier with evidence, options, and review action
    
    opt Qualified Person Sign-Off
        Operator->>Gate: Authorize Proposal (Dr. Ananya Sharma, R.Ph)
        Gate->>Tools: Execute validate_and_execute_proposal()
        Tools->>DB: Re-validate invariants -> Mutate status to dispatch_hold -> Log movement
        DB-->>Operator: State updated & audit record confirmed
    end
```

---

## 4. Backend Architecture & Component Directory

### 4.1 Database Schema & Relational Models (`db_models.py`)
File: [`backend/app/db_models.py`](file:///home/phoolghobhi/agentic-hackathon/backend/app/db_models.py)

A normalized, relational schema utilizing SQLAlchemy ORM. All timestamps are UTC-indexed, and foreign keys enforce referential integrity with cascade controls:

| Model Class | Table Name | Key Attributes | Relationships | Domain Purpose |
|---|---|---|---|---|
| `Product` | `products` | `id`, `sku`, `name`, `molecule`, `brand`, `category`, `storage_range`, `is_critical`, `unit_price`, `min_safety_stock` | `batches`, `dispatches`, `purchase_orders` | Master pharmaceutical product catalog; flags life-saving critical drugs and temperature requirements. |
| `Warehouse` | `warehouses` | `id`, `code`, `name`, `location`, `cold_storage_available` | `batches`, `temperature_logs` | Physical distribution centers (e.g., Central Depot, North Cold Hub, West Depot). |
| `BatchInventory` | `batch_inventories` | `id`, `batch_number`, `product_id`, `warehouse_id`, `available_quantity`, `initial_quantity`, `manufacturing_date`, `expiry_date`, `status`, `storage_condition` | `product`, `warehouse`, `movements`, `dispatches` | Master batch records. Status values: `active`, `quarantine`, `dispatch_hold`, `recalled`, `expired`. |
| `StockMovement` | `stock_movements` | `id`, `batch_id`, `movement_type`, `quantity`, `reference_doc`, `timestamp`, `notes` | `batch` | Immutable audit ledger tracking every receipt, dispatch, quarantine hold, release, and transfer. |
| `Customer` | `customers` | `id`, `code`, `name`, `customer_type`, `contact_email`, `phone`, `address`, `priority_tier` | `dispatches` | Healthcare accounts. Categorizes Tier 1 Emergency Hospitals (`priority_tier=1`) from Retail Chemists (`priority_tier=2`). |
| `Dispatch` | `dispatches` | `id`, `dispatch_number`, `customer_id`, `batch_id`, `product_id`, `quantity`, `dispatch_date`, `status`, `tracking_ref` | `customer`, `batch`, `product` | Forward chain-of-custody dispatches. Tracks every unit delivered outward. |
| `Supplier` | `suppliers` | `id`, `name`, `contact_email`, `phone`, `lead_time_days`, `min_order_quantity`, `return_window_days` | `purchase_orders` | Manufacturer terms. Defines contractual Minimum Order Quantities (MOQ) and pre-expiry return windows (MSAs). |
| `PurchaseOrder` | `purchase_orders` | `id`, `po_number`, `supplier_id`, `product_id`, `quantity`, `unit_price`, `status`, `urgency`, `notes` | `supplier`, `product` | Procurement orders (`draft`, `submitted`, `approved`, `fulfilled`). |
| `TemperatureLog`| `temperature_logs` | `id`, `warehouse_id`, `cold_room_unit`, `recorded_at`, `temperature_celsius`, `is_excursion`, `duration_minutes`, `alert_sent` | `warehouse` | Continuous IoT cold-chain telemetry logger (flags readings outside 2°C–8°C). |
| `Incident` | `incidents` | `id`, `incident_number`, `title`, `incident_type`, `severity`, `affected_batch_number`, `status`, `details_json` | `proposals` | Master operational incident container (`recall`, `expiry_risk`, `temperature_excursion`, `shortage`). |
| `AgentRun` | `agent_runs` | `id`, `prompt`, `incident_id`, `state`, `intent_json`, `plan_json`, `current_step`, `evidence_json`, `verification_json`, `recommendation_json`, `final_report_json` | `events`, `proposals` | Complete execution session container for the autonomous decision-support engine. |
| `AgentEvent` | `agent_events` | `id`, `run_id`, `step_number`, `stage`, `event_type`, `tool_name`, `message`, `data_json`, `timestamp` | `run` | Granular step-by-step trace of every tool call, result, verification assertion, and state change. |
| `ActionProposal`| `action_proposals` | `id`, `run_id`, `incident_id`, `action_type`, `title`, `description`, `rationale`, `supporting_evidence`, `target_entity`, `expected_impact`, `status`, `approved_by`, `approved_at`, `rejection_reason` | `run`, `incident`, `decisions` | Staged action awaiting Qualified Person sign-off (`pending_review`, `approved`, `rejected`). |
| `ApprovalDecision`| `approval_decisions`| `id`, `proposal_id`, `decision`, `approver_role`, `approver_name`, `notes`, `timestamp` | `proposal` | Legal compliance audit record capturing reviewer identity, role, notes, and timestamp. |

---

### 4.2 Configuration & Environment Management (`config.py`)
File: [`backend/app/config.py`](file:///home/phoolghobhi/agentic-hackathon/backend/app/config.py)

Uses Pydantic `BaseSettings` with strict type validation:
- **Database Path Resolution**: Automatically resolves relative SQLite paths to the canonical absolute path on disk (`backend/arogya.db`), eliminating multi-process path divergence bugs.
- **AI Settings**: Configures inference provider (`ollama`, `openai`, `openai_compatible`), base URL (`http://localhost:11434/v1`), model identifier (`qwen2.5-coder:7b`), and timeout limits.
- **CORS Setup**: Safely binds allowed frontend development origins (`http://localhost:5173`, `http://127.0.0.1:5173`).

---

### 4.3 AI Inference & Semantic Fallback Layer (`ai_provider.py`)
File: [`backend/app/agent/ai_provider.py`](file:///home/phoolghobhi/agentic-hackathon/backend/app/agent/ai_provider.py)

Implements the `BaseAIProvider` abstraction with two production implementations:

1. **`OpenAICompatibleProvider`**:
   - Connects directly to local Ollama (or any standard OpenAI-compatible server: vLLM, LocalAI, LMStudio).
   - Monitors real-time latency (averaging ~7ms locally).
   - Generates completions for natural-language entity extraction and executive briefings.
   - Includes timeout safeguards preventing hanging requests.

2. **`DeterministicSemanticEngine`**:
   - Zero-token, high-speed fallback provider that activates automatically if the local LLM server is unreachable or offline.
   - Uses domain-specific semantic grammar rules and regex entity matchers to parse batches, dates, locations, and actions.
   - Guarantees 100% operational uptime without requiring internet access or paid API keys.

3. **`generate_text` Convenience Method**:
   - Built directly into `BaseAIProvider` with structured fallback commentary ensuring safe, non-hallucinatory explanations.

---

### 4.4 Autonomous Agent Orchestrator (`orchestrator.py`)
File: [`backend/app/agent/orchestrator.py`](file:///home/phoolghobhi/agentic-hackathon/backend/app/agent/orchestrator.py)

Executes the autonomous reasoning workflow:
- **`run_task(prompt, mode)`**: Main entry point executing the 7-stage cognitive loop.
- **Entity Resolution**: Identifies target batches (`B2231`, `B1042`, `B3011`), products, warehouses, and constraints.
- **Diagnostic Tool Scheduling**: Invokes tools in logical sequence, passing intermediate findings forward.
- **Synthesis & Option Formulation**: Constructs at least two viable operational response strategies (e.g., Hospital Defense vs. Pro-Rata Rationing).
- **Independent Invariant Verifier**: Automatically runs deterministic verification rules directly against database tables before staging any proposals.
- **Audit Persistence**: Writes all reasoning steps into `AgentEvent` and stages proposed actions into `ActionProposal`.

---

### 4.5 Deterministic Application Tool Registry (`registry.py`)
File: [`backend/app/tools/registry.py`](file:///home/phoolghobhi/agentic-hackathon/backend/app/tools/registry.py)

A suite of 13 deterministic, audited Python functions operating directly on the relational database:

1. **`get_inventory_by_batch(db, batch_number)`**: Returns batch location, on-hand available quantity, initial quantity, status, and expiry details.
2. **`trace_batch_recipients(db, batch_number)`**: Gathers every outward dispatch record; separates Tier 1 Emergency Hospitals from Retail Chemists.
3. **`get_batch_movements(db, batch_number)`**: Retrieves chronological ledger movements (receipts, holds, dispatches).
4. **`calculate_replacement_coverage(db, recalled_batch, replacement_batch, lead_time_days)`**: Reconciles physical warehouse stock from outward dispatched stock; calculates net replacement deficit against forecast demand; checks supplier MOQ.
5. **`get_temperature_excursions(db, hours_threshold)`**: Detects sensor breaches (>8°C); identifies all biological batches co-located in the affected cold room.
6. **`get_expiry_risks_and_fefo(db, days_threshold)`**: Flags batches nearing expiration; constructs First-Expired First-Out (FEFO) priority queue.
7. **`calculate_supplier_return_window(db, days_threshold)`**: Audits expiring stock against contractual supplier Master Services Agreements (MSAs) to calculate recoverable credit value before return windows close.
8. **`calculate_shortage_risk(db, sku_or_product_id)`**: Calculates clinical burn rates and days of cover (DoC); alerts when runway dips below 30 days.
9. **`compare_operational_options(db, scenario_type, ...)`**: Generates structured multi-option comparative matrices with pros, cons, costs, lead times, and clinical impacts.
10. **`verify_operational_invariants(db, batch_number, ...)`**: Independent invariant checker validating that $\sum \text{dispatches}$ matches ground truth, eligible alternative stock is not over-allocated, and purchase orders respect supplier MOQ.
11. **`get_supplier_information(db, product_id)`**: Retrieves manufacturer lead time, MOQ, and contact points.
12. **`get_attention_items(db)`**: Generates prioritized triage exceptions for the operations dashboard.
13. **`validate_and_execute_proposal(db, proposal, approver_name, approver_role)`**: The gate execution engine. Re-validates invariants against fresh database state, applies batch status mutations (`dispatch_hold`, `quarantine`), logs movements, and issues purchase orders.

---

### 4.6 What-If Supply Chain Simulation Engine (`engine.py`)
File: [`backend/app/simulator/engine.py`](file:///home/phoolghobhi/agentic-hackathon/backend/app/simulator/engine.py)

The core engine behind the standout **What-If Simulator**:
- **Isolation by Design**: Executes read-only queries against live tables; performs in-memory math; returns hypothetical outcomes without calling `db.commit()` on inventory tables.
- **Scenario Models**: Implements dedicated modeling algorithms for Recalls, Cold-Chain Breaches, Expiry Risks, Supplier Delays, Hospital Surges, and Warehouse Stockouts.
- **Multi-Strategy Generator**: Evaluates Hospital Defense vs. Pro-Rata Rationing vs. Inter-Depot Transfers.
- **Natural Language Parameter Extractor**: Extracts scenario types, batch numbers, percent surges, and delay days with word-boundary protection.

---

### 4.7 REST API Route Handlers (`routers/`)

The FastAPI application mounts modular, database-driven route handlers:
- **`routers/dashboard.py`**: Executive summary counts (`/api/dashboard/summary`), live triage feed (`/api/dashboard/attention-items`).
- **`routers/products.py`**: Master catalog search, filtering by storage range and critical status, and detail view with related batches and POs (`/api/products`).
- **`routers/customers.py`**: Healthcare accounts registry, priority tier metrics, location filters, and customer dispatch history (`/api/customers`).
- **`routers/suppliers.py`**: Manufacturer records, MOQ compliance, contractual return windows, lead-time metrics, and supplier creation (`/api/suppliers`).
- **`routers/batches.py`**: Multi-warehouse batch inventory, FEFO query queue, expiry status, and batch detail lookups (`/api/batches`).
- **`routers/inventory.py`**: Legacy and unified batch inventory endpoints, movements, and stock reconciliation (`/api/inventory`).
- **`routers/dispatches.py`**: Complete outward dispatch ledger, customer delivery traces, and strict GDP dispatch validation (`/api/dispatches`).
- **`routers/purchase_orders.py`**: Purchase order tracking, overdue audits based on configured business date (`2026-11-16`), delivery schedules, and automated reorder recommendations (`/api/purchase-orders`).
- **`routers/recalls.py`**: Regulatory recall registry, affected batch quarantine workflows, outward customer exposure trace, and incident generation (`/api/recalls`).
- **`routers/temperature_logs.py`**: Cold-chain IoT sensor readings, thermal excursion audits (>8°C and <2°C), and affected inventory identification (`/api/temperature-logs`).
- **`routers/analytics.py`**: Aggregated dispatch demand trends, daily/weekly volume charts, warehouse distribution, and critical drug velocity (`/api/analytics`).
- **`routers/alerts.py`**: Consolidated operational alert feed across recalls, thermal excursions, near-expiry stock, and overdue orders (`/api/alerts`).
- **`routers/agent.py`**: Autonomous cognitive execution (`/api/agent/run`), execution history (`/api/agent/runs`), dossier details (`/api/agent/runs/{id}`), and agent data creation (`/api/agent/create-data`).
- **`routers/approvals.py`**: Human-in-the-loop sign-off (`/api/approvals/{id}/action`), pending proposal list (`/api/approvals`), custom proposal submission (`/api/approvals/custom`), and proposal editing.
- **`routers/simulator.py`**: Preset benchmark scenarios (`/api/simulator/scenarios`), isolated simulation execution (`/api/simulator/run`), natural-language parsing (`/api/simulator/parse-prompt`), local AI briefings (`/api/simulator/explain`), and proposal staging (`/api/simulator/propose`).
- **`routers/health.py`**: Diagnostics, local AI provider health and latency telemetry, and database connectivity (`/api/health`).
- **`routers/demo.py` & `routers/admin.py`**: Safe administrative resets and test initialization.
- **`routers/workflow.py`**: Pre-configured task template blueprints.

---

### 4.8 Full Pharmaceutical Distribution Dataset Integration (`07_pharma_distribution.zip`)

Arogya AI fully integrates the complete real-world pharmaceutical distribution dataset from `07_pharma_distribution.zip` without truncating, fabricating, or synthesizing any records. Every metric, chart, alert, and agent answer is grounded in actual database rows.

#### Dataset Inventory & Database Row Counts

| Dataset File | Expected CSV Rows | Imported Dataset Rows | Baseline Seed Rows | Total Persisted in SQLite | Primary Key / Identifying Field |
|---|---:|---:|---:|---:|---|
| `products.csv` | 75 | 75 | 6 | **81** | `sku` |
| `customers.csv` | 420 | 420 | 25 | **445** | `code` (`customer_id`) |
| `suppliers.csv` | 75 | 75 | 3 | **78** | `sku` / `manufacturer` |
| `batch_inventory.csv` | 338 | 338 | 6 | **344** | `batch_number` + `warehouse_id` |
| `dispatches.csv` | 5,174 | 5,174 | 25 | **5,199** | `dispatch_number` |
| `purchase_orders.csv` | 30 | 30 | 1 | **31** | `po_number` |
| `recalls.csv` | 2 | 2 | 0 | **2** | `recall_id` (`B2231`, `B0999`) |
| `temperature_logs.csv` | 1,008 | 1,008 | 4 | **1,012** | `log_id` (`sensor_id` + timestamp) |

#### Key Integration Capabilities:
1. **Repeatable & Idempotent Ingestion Pipeline**:
   The synchronization script [`scripts/import_datasets.py`](file:///home/phoolghobhi/agentic-hackathon/scripts/import_datasets.py) safely upserts records. Re-running the import never duplicates batches, customers, or dispatches.
   ```bash
   python scripts/import_datasets.py
   ```
2. **Schema Migration & Indexing**:
   - Auto-migrates database schemas to support multi-warehouse batches (`BatchInventory` has composite indexes for `batch_number` and `warehouse_id`).
   - Supports non-unique batch numbers across different regional warehouses (e.g., Bengaluru Depot vs. Mysuru Depot).
3. **Configurable Business Reference Date (`2026-11-16`)**:
   The dataset represents an operational snapshot dated **November 16, 2026**.
   - PO overdue status is strictly evaluated against this reference date (e.g., `PO-0688` expected `2026-11-05` is correctly flagged as overdue).
   - Expiry calculations, days-to-expiry (DoE), and contractual supplier return windows are dynamically measured from `BUSINESS_REFERENCE_DATE`.
4. **Cross-Referencing & Incident Automation**:
   - Reconciles recalled batches `B2231` (Class II, Meropenem) and `B0999` (Class III, Cefixime) against inventory and dispatch ledgers.
   - Automatically marks recalled batches as `recalled` / `dispatch_hold` and creates high-priority `Incident` records.
   - Identifies outward patient/account exposure across 8 hospitals and retail chemists.

---

### 4.9 Operational Data Ingestion via Agent Workspace & GDP Guardrails

Arogya AI empowers operations personnel to directly inject operational records through the **Agent Workspace** while strictly enforcing Good Distribution Practice (GDP) invariants:

#### Ingestion Channels:
1. **Interactive "+ Add Operational Data via Agent" Modal**:
   Structured tabbed interface across 7 entity types:
   - **Batch Lots**: SKU, batch number, warehouse, quantity, manufacturing date, expiry date, storage condition.
   - **Purchase Orders**: PO identifier, manufacturer, SKU, quantity, expected delivery date, status.
   - **Temperature Telemetry**: Warehouse, cold room ID, sensor ID, recorded temperature (°C), excursion duration.
   - **Outward Dispatches**: Dispatch number, customer code, batch number, SKU, quantity, tracking reference.
   - **Customer Accounts**: Customer code, name, customer type (Hospital / Chemist / Clinic), location, credit terms.
   - **Suppliers & Manufacturers**: Manufacturer, SKU, lead time (days), MOQ (units), return window (days).
   - **Regulatory Recalls**: Recall ID, SKU, affected batch numbers, reason, recall classification (Class I / II / III).

2. **Cognitive Reasoning Loop Natural-Language Ingestion**:
   Operators can speak naturally into the agent console:
   - *"Add batch lot B-9999 for SKU-001 with 500 units at BLR warehouse expiring in 2027"*
   - *"Create purchase order PO-9999 for Cipla with 1,000 units of SKU-001 expected on 2026-12-01"*
   - *"Log cold chain temperature of 9.5C for CR-01 in Bengaluru warehouse"*
   - *"Issue recall for batch B2231 affecting SKU-001 due to particulate contamination"*

#### Strict Regulatory Guardrails & Invariants:
- **Zero Recalled Dispatch**: The system rigorously denies any outward dispatch of recalled batches (e.g., `B2231`) or expired lots, returning `HTTP 403 Forbidden`.
- **Automatic Incident Quarantine**: Ingesting a recall immediately places all co-located and corresponding batches into `dispatch_hold` / `recalled` and spawns a Class II/III incident ticket.
- **Supplier MOQ & Lead Time Integrity**: Purchase orders validate manufacturer constraints and MOQ compliance.
- **Thermal Boundary Alerts**: Sensor readings outside 2.0°C – 8.0°C immediately trigger active excursion alerts and flag co-located thermo-labile inventory.

---

## 5. Frontend Operations Control Centre

The frontend is an enterprise operations control center built with **React 19**, **TypeScript**, and **Vite**, styled with an accessible high-contrast slate/indigo theme.

### 5.1 Design System & Navigation Shell (`App.tsx`)
File: [`frontend/src/App.tsx`](file:///home/phoolghobhi/agentic-hackathon/frontend/src/App.tsx)

### 5.1 Design System & Navigation Shell (`App.tsx`)
File: [`frontend/src/App.tsx`](file:///home/phoolghobhi/agentic-hackathon/frontend/src/App.tsx)

The application shell provides persistent top-level navigation across **16 operational modules**:
- Real-time environment and local AI status indicators in the header.
- Dynamic pending approval badge count updated across actions.
- Cross-tab investigation shortcuts (clicking an attention item or batch jumps directly to the agent workspace or simulator).
- Full live relational data backing every table, chart, filter, and metric card.

---

### 5.2 View Components Directory (`components/`)

```
frontend/src/components/
├── OperationsDashboard.tsx     # Executive metrics KPIs, active triage feed, warehouse distribution
├── BatchExplorer.tsx           # Searchable multi-depot batch inventory table, bin locations, CRUD modal
├── ProductCatalogueView.tsx    # 75+ product catalog, molecules, storage ranges, critical flags, PO links
├── CustomerManagementView.tsx  # 420+ healthcare accounts, tiers, locations, credit terms, dispatch history
├── SupplierManagementView.tsx  # 75+ manufacturers, SKU associations, lead times, MOQs, return windows
├── PurchaseOrdersView.tsx      # 30+ purchase orders, overdue tracking (2026-11-16 reference), reorders
├── DispatchAnalyticsView.tsx   # 5,174+ dispatches, demand velocity, daily/weekly volume charts
├── RecallManagementView.tsx    # Class II & III recalls, affected batch lookup, quarantine, forward trace
├── ColdChainView.tsx           # IoT temperature sensors, cold room units, excursion logger & audits
├── BatchTraceabilityView.tsx   # Forward & reverse trace, hospital vs chemist breakdown
├── ExpiryReturnsView.tsx       # FEFO queue, pre-expiry audit, supplier return window calculator
├── ShortagePlanningView.tsx    # Critical drug catalog, days of cover (DoC) meters, PO manager
├── WhatIfSimulatorView.tsx     # STANDOUT FEATURE: Predictive sandbox, sliders, strategy matrix
├── AgentWorkspaceView.tsx      # Dual-panel AI console, "+ Add Operational Data" modal, GDP verification
├── ApprovalCenterView.tsx      # Qualified Person (R.Ph) portal, authorization modal, custom proposals
├── AuditLogView.tsx            # Chronological ledger of all agent runs, dossiers, and events
├── SettingsView.tsx            # AI provider telemetry, invariant rules summary, database admin
├── Header.tsx                  # System status bar, AI provider latency, QP environment badge
└── [Supporting UI Panels]      # LoadingState, ErrorBanner, EmptyState, StagesView, ResultsPanel
```

#### Detailed View Breakdown:

1. **`OperationsDashboard.tsx`**:
   - Real-time database metrics: Total products (81), customers (445), inventory units (142k+), and batch records (344).
   - High-priority attention feed prioritizing regulatory recalls, thermal excursions, and overdue POs with single-click investigation triggers.
   - Warehouse inventory unit distribution chart across Bengaluru, Mysuru, Hubballi, Central, North, and West depots.

2. **`ProductCatalogueView.tsx`**:
   - Master pharmaceutical catalog loaded directly from `products.csv` (75 records).
   - Search and filter by SKU, molecule, brand name, ATC category, storage temperature condition, and critical drug classification.
   - Integrated drill-down displaying associated on-hand batches, purchase orders, and dispatch velocity.

3. **`CustomerManagementView.tsx`**:
   - Healthcare accounts directory loaded from `customers.csv` (420 records).
   - Segregation between Tier 1 Emergency Hospitals, Tier 2 Retail Chemists, and Diagnostic Clinics.
   - Complete dispatch delivery history per customer with unit quantities and tracking codes.

4. **`SupplierManagementView.tsx`**:
   - Manufacturer database loaded from `suppliers.csv` (75 records).
   - Real-time audit of Minimum Order Quantity (MOQ), supplier delivery lead times, and contractual pre-expiry return windows.
   - Reorder risk indicators flagging products where supplier lead times exceed current warehouse runway.

5. **`PurchaseOrdersView.tsx`**:
   - Complete purchase order ledger from `purchase_orders.csv` (30 records).
   - Overdue order detection calculated against configurable reference date (`2026-11-16`), correctly identifying `PO-0688` and other delayed shipments.
   - Automated reorder recommendation engine factoring in lead times, MOQ thresholds, and hospital demand rates.

6. **`DispatchAnalyticsView.tsx`**:
   - Comprehensive outbound logistics ledger loaded from `dispatches.csv` (5,174 records).
   - Interactive daily and weekly dispatch volume trend charts.
   - Top-dispatched formulations breakdown, warehouse fulfillment volumes, and hospital vs. chemist allocation splits.

7. **`RecallManagementView.tsx`**:
   - Regulatory recall register loaded from `recalls.csv` (Batch B2231 Class II & Batch B0999 Class III).
   - Deep reconciliation against current inventory and forward outward dispatches.
   - Active quarantine flags and strict dispatch lockout barriers preventing recalled stock from outward movement.

8. **`ColdChainView.tsx`**:
   - Complete IoT sensor telemetry loaded from `temperature_logs.csv` (1,008 records).
   - Real-time analysis of cold room units (CR-01 through CR-06), excursion durations, and min/max/average metrics.
   - Co-located biological inventory auditing isolating affected stock without halting unrelated cold rooms.

9. **`BatchExplorer.tsx`**:
   - Complete multi-warehouse batch catalog with real-time filtering by status (`active`, `quarantine`, `dispatch_hold`), warehouse (BLR, MYS, HUB, Central, North, West), or molecule.
   - First-Expired, First-Out (FEFO) sorting, days remaining until expiry, and storage condition badges.

10. **`AgentWorkspaceView.tsx`**:
    - Dual-panel AI operations console supporting natural-language questions and operational workflows.
    - **Interactive "+ Add Operational Data via Agent" modal** allowing operators to insert batches, POs, temperature logs, dispatches, customers, suppliers, and recalls with GDP validation.
    - 7-stage cognitive loop visual tracker, independent verification audit checklist, multi-strategy comparison cards, and staged proposals.

11. **`WhatIfSimulatorView.tsx` (Standout Feature)**:
    - Dedicated predictive modeling sandbox with 0 physical ledger mutation risk.
    - Preset benchmark chips (B2231 Recall, CR-02 Excursion, B1042 Expiry, Supplier Delay, ICU Surge).
    - Natural language scenario console with Local AI explanation briefing.
    - Interactive parameter tuner (Demand Surge %, Delay Days, Hospital Priority Weight).
    - Side-by-side Strategy Comparison Cards with hospital allocation meters, cost, lead time, and runway.

12. **`ApprovalCenterView.tsx`**:
    - Human-in-the-loop Qualified Person (R.Ph) portal.
    - Detailed modal capturing Qualified Person Name, Professional Role, and Verification Notes.
    - Dedicated "Create Custom Proposal" and "Edit Proposal" modals for operational flexibility.

13. **`ExpiryReturnsView.tsx`**, **`ShortagePlanningView.tsx`**, **`BatchTraceabilityView.tsx`**, **`AuditLogView.tsx`**, & **`SettingsView.tsx`**:
    - Specialized clinical operations tools for DoC monitoring, ledger auditing, and invariant checks.

---

### 5.3 Type Definitions & API Client Service
- **`frontend/src/types/arogya.ts`**: Exhaustive TypeScript interfaces for `Product`, `BatchInventory`, `Customer`, `Dispatch`, `TemperatureLog`, `PurchaseOrder`, `ActionProposal`, `AgentRun`, and all What-If Simulator requests/results.
- **`frontend/src/services/api.ts`**: Clean, centralized API client handling HTTP calls with strict type checking and error boundaries.

---

## 6. What-If Supply Chain Simulator (Standout Feature)

The **Arogya AI What-If Supply Chain Simulator** is an isolated operations modeling environment engineered to test hypothetical operational disruptions before committing real physical inventory.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                      WHAT-IF SUPPLY CHAIN SIMULATOR WORKFLOW                           │
└────────────────────────────────────────────────────────────────────────────────────────┘
     ┌────────────────────────┐                   ┌────────────────────────┐
     │ 1. Select Incident or  │                   │ 2. Tune Parameters     │
     │ Natural Language Input │ ────────────────> │ • Demand Surge (0-100%)│
     │ (e.g. B2231 Recall)    │                   │ • Delay (0-30 days)    │
     └────────────────────────┘                   │ • Hospital Weight (1-5)│
                                                  └────────────────────────┘
                                                               │
                                                               ▼
                                                  ┌────────────────────────┐
                                                  │ 3. Isolated Engine     │
                                                  │ Deterministic math     │
                                                  │ ZERO live DB mutations │
                                                  └────────────────────────┘
                                                               │
                                                               ▼
                                                  ┌────────────────────────┐
                                                  │ 4. Multi-Strategy Card │
                                                  │ Strategy 1 vs Strategy │
                                                  │ Meters, Cost, Runway   │
                                                  └────────────────────────┘
                                                               │
                                                               ▼
                                                  ┌────────────────────────┐
                                                  │ 5. Stage for Approval  │
                                                  │ Creates ActionProposal │
                                                  │ QP Sign-off Required   │
                                                  └────────────────────────┘
```

### 6.1 Zero Live Mutation Sandbox
- Unlike standard operations, the simulator runs strictly read-only against database tables.
- No `db.commit()` calls mutate batch status, dispatches, movements, or purchase orders during simulation runs.
- Operators can stress-test extreme edge cases (e.g., +100% demand surge, 30-day supplier shutdowns) with 100% safety.

### 6.2 Disruption Scenarios Modeled
1. **Batch Regulatory Recall (FDA/CDSCO Class II Benchmark)**:
   - Evaluates outward dispatch of recalled lot (e.g., Batch B2231).
   - Reconciles replacement batch inventory (e.g., B2232 / B2240).
   - Dynamically calculates replacement shortfall and supplier MOQ-compliant replenishment orders.
2. **Cold-Chain Thermal Excursion**:
   - Models sensor excursions (>8°C) in cold room units (e.g., CR-02).
   - Compares 48-hour analytical laboratory HPLC stability assay holds against immediate batch write-offs.
3. **Pre-Expiry Vendor RMA Return**:
   - Identifies lots nearing shelf-life boundaries (e.g., Batch B1042).
   - Evaluates 100% manufacturer credit recovery within 60-day contractual return windows versus inter-depot reallocation.
4. **Primary Manufacturer Lead-Time Delay**:
   - Models factory production disruptions (e.g., Sun Pharma +14 days delay).
   - Projects inventory stockout dates against daily consumption velocity.
5. **Acute Hospital ICU Demand Surge**:
   - Models sudden epidemic or seasonal demand spikes (+10% to +100%) from affiliated hospitals.
   - Calculates hospital ring-fencing boundaries to protect life-saving inpatient care.
6. **Depot Buffer Stockout**:
   - Evaluates inter-warehouse depot transfers against expedited factory runs.

### 6.3 Multi-Strategy Comparison Matrix
For every simulation run, the engine generates at least two distinct, feasible strategies:
- **Strategy 1: Priority Hospital Defense & Emergency Supplier Order (Recommended)**: Ring-fences 100% of replacement stock for Tier 1 hospital emergency departments; rations retail pharmacies; issues MOQ-compliant emergency purchase order.
- **Strategy 2: Pro-Rata Equal Rationing Across Accounts**: Allocates replacement stock equally across all accounts without prioritization, creating potential hospital ICU stockouts.
- **Strategy 3: Inter-Warehouse Depot Transfer**: Bridges shortfalls via road transit from regional branch warehouses.

### 6.4 Local AI Interpretation & Qualified Person Staging
- **Local AI Briefings**: The local AI model (`qwen2.5-coder:7b`) explains the clinical and procurement dynamics in clear pharmaceutical operations terminology.
- **Staging Action Proposals**: Clicking **"Stage Strategy for Approval"** creates an official `ActionProposal` in `pending_review` status.
- **Strict Authorization Gate**: The proposed action cannot mutate live state until a Qualified Person (R.Ph) formally reviews and approves it in the **Approval Center**.

---

## 7. Safety Barriers, Governance & Compliance Controls

Arogya AI enforces hard clinical and regulatory safety barriers:

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                         CLINICAL & REGULATORY SAFETY GATES                       │
├──────────────────────────────────────────────────────────────────────────────────┤
│ [HARD GATE 1] DISPATCH LOCKOUT                                                   │
│ Any batch with status 'quarantine', 'dispatch_hold', or 'recalled' is hard-      │
│ blocked from outward dispatch. The API immediately returns HTTP 403 Forbidden.   │
├──────────────────────────────────────────────────────────────────────────────────┤
│ [HARD GATE 2] QUALIFIED PERSON (R.Ph) APPROVAL MANDATE                           │
│ The AI cannot autonomously mutate database state or create real purchase orders. │
│ All consequential actions are staged as ActionProposal (pending_review) and      │
│ require formal authorization with reviewer name, role, and rationale.            │
├──────────────────────────────────────────────────────────────────────────────────┤
│ [HARD GATE 3] PRE-EXECUTION INVARIANT RE-ASSERTION                               │
│ When a Qualified Person approves an action, ToolRegistry re-asserts all physical │
│ invariants against the live database before executing mutations.                 │
├──────────────────────────────────────────────────────────────────────────────────┤
│ [HARD GATE 4] CLINICAL SAFETY BOUNDARY DISCLAIMER                                │
│ The agent explicitly disclaims clinical safety determinations. Telemetry logs    │
│ indicate temperature breaches, but analytical lab assays are mandated before     │
│ releasing affected biologics.                                                    │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

## 8. Complete REST API Reference

### 8.1 Health & Diagnostics
```http
GET /api/health
```
**Response (200 OK):**
```json
{
  "status": "ok",
  "app_name": "Arogya AI — Pharmaceutical Inventory Intelligence",
  "version": "1.0.0",
  "environment": "development",
  "ai_provider": {
    "is_online": true,
    "provider": "ollama",
    "model": "qwen2.5-coder:7b",
    "latency_ms": 7.4,
    "message": "Connected to ollama at http://localhost:11434/v1 (7.4ms)"
  },
  "database_status": "connected"
}
```

---

### 8.2 Operations Dashboard
```http
GET /api/dashboard/summary
```
**Response (200 OK):**
```json
{
  "total_products": 6,
  "total_batches": 12,
  "active_alerts": 4,
  "batches_near_expiry": 2,
  "active_recalls": 1,
  "cold_chain_exceptions": 1,
  "pending_approvals": 2,
  "attention_items": [
    {
      "id": "attn-recall-1",
      "priority": "critical",
      "category": "recall",
      "title": "URGENT: Regulatory Recall Alert - Batch B2231",
      "description": "Class II regulatory recall for Meropenem 1g (Batch B2231). Requires immediate dispatch hold and trace.",
      "batch_number": "B2231",
      "action_prompt": "Investigate recall Batch B2231."
    }
  ],
  "timestamp": "2026-10-10T00:00:00Z"
}
```

---

### 8.3 Inventory Management
```http
GET /api/inventory/batches
GET /api/inventory/batches/{batch_number}
POST /api/inventory/batches
PUT /api/inventory/batches/{batch_number}
```

**Create Batch Request (`POST /api/inventory/batches`):**
```json
{
  "batch_number": "B9901",
  "product_id": 1,
  "warehouse_id": 1,
  "available_quantity": 500,
  "initial_quantity": 500,
  "manufacturing_date": "2026-01-15T00:00:00Z",
  "expiry_date": "2027-01-15T00:00:00Z",
  "status": "active",
  "storage_condition": "Controlled Room Temp (15-25°C)"
}
```

**Outward Dispatch Lockout Verification (`POST /api/inventory/dispatches`):**
```json
{
  "batch_number": "B2231",
  "customer_id": 1,
  "quantity": 50
}
```
*If Batch B2231 is under dispatch hold, returns:*
```json
{
  "detail": "Dispatch rejected: Batch 'B2231' is currently under 'dispatch_hold' and cannot be dispatched."
}
```
*(HTTP 403 Forbidden)*

---

### 8.4 Autonomous Agent Workspace
```http
POST /api/agent/run
```
**Request:**
```json
{
  "prompt": "Investigate recall Batch B2231 and prepare response options.",
  "mode": "operations"
}
```
**Response (200 OK):**
```json
{
  "id": "RUN-20261010-ABCD1234",
  "prompt": "Investigate recall Batch B2231 and prepare response options.",
  "state": "awaiting_approval",
  "current_step": 7,
  "final_report": "Batch B2231 investigation complete. 640 units outward dispatched across 8 accounts. Replacement lot B2240 has 400 units, creating a 600-unit net deficit. Action proposals staged for Qualified Person review.",
  "events_count": 8,
  "proposals_count": 2
}
```

---

### 8.5 Approval Center (Qualified Person Portal)
```http
GET /api/approvals?status=pending_review
POST /api/approvals/{proposal_id}/action
```

**Authorize Proposal Request (`POST /api/approvals/1/action`):**
```json
{
  "decision": "approved",
  "approver_name": "Dr. Ananya Sharma, R.Ph",
  "approver_role": "Chief Pharmacist (R.Ph / QP)",
  "notes": "Verified outward recipient trace and mathematical replacement coverage. Approved for execution."
}
```
**Response (200 OK):**
```json
{
  "id": 1,
  "run_id": "RUN-20261010-ABCD1234",
  "action_type": "dispatch_hold",
  "title": "Recall Dispatch Freeze: Batch B2231",
  "status": "approved",
  "approved_by": "Dr. Ananya Sharma, R.Ph (Chief Pharmacist (R.Ph / QP))",
  "approved_at": "2026-10-10T05:00:00Z"
}
```

---

### 8.6 What-If Supply Chain Simulator
```http
GET  /api/simulator/scenarios
POST /api/simulator/run
POST /api/simulator/parse-prompt
POST /api/simulator/explain
POST /api/simulator/propose
```

**Run Simulation Request (`POST /api/simulator/run`):**
```json
{
  "scenario_type": "recall",
  "batch_number": "B2231",
  "replacement_batch_number": "B2232",
  "demand_surge_percent": 15.0,
  "supplier_delay_days": 7,
  "hospital_priority_weight": 2.0
}
```
**Response (200 OK):**
```json
{
  "simulation_id": "SIM-8F2B1C4D",
  "scenario_name": "Batch B2231 Recall & Multi-Strategy Replacement Analysis",
  "scenario_type": "recall",
  "parameters_used": {
    "batch_number": "B2231",
    "replacement_batch": "B2232",
    "demand_surge_percent": 15.0,
    "hospital_priority_weight": 2.0
  },
  "baseline": {
    "recalled_batch_depot_units": 180,
    "recalled_batch_dispatched_units": 640,
    "hospital_units_at_risk": 390,
    "chemist_units_at_risk": 250,
    "replacement_batch_available_units": 400
  },
  "strategies": [
    {
      "strategy_id": "STRAT-1-HOSPITAL-PRIORITY-PO",
      "name": "Strategy 1: Priority Hospital Defense & Emergency Supplier Order",
      "hospital_fulfillment_percent": 100.0,
      "retail_fulfillment_percent": 25.0,
      "replacement_deficit": 600,
      "emergency_order_units": 600,
      "estimated_cost": 15000.0,
      "lead_time_days": 7,
      "projected_runway_days": 30,
      "pros": [
        "100% protection for acute hospital ICU & inpatient wards",
        "Adheres to supplier MOQ (500 units) with verified delivery window"
      ],
      "cons": [
        "Temporary partial allocation to retail chemists until PO arrives"
      ],
      "is_recommended": true,
      "action_proposals": [
        {
          "action_type": "dispatch_hold",
          "title": "Recall Dispatch Freeze: Batch B2231",
          "target_entity": "Batch B2231",
          "rationale": "Regulatory containment.",
          "expected_impact": "Prevents compromised units from entering healthcare supply chain."
        }
      ]
    },
    {
      "strategy_id": "STRAT-2-PRO-RATA-RATIONING",
      "name": "Strategy 2: Pro-Rata Equal Rationing Across All Accounts",
      "hospital_fulfillment_percent": 58.3,
      "retail_fulfillment_percent": 58.3,
      "replacement_deficit": 600,
      "emergency_order_units": 0,
      "estimated_cost": 0.0,
      "lead_time_days": 0,
      "projected_runway_days": 18,
      "pros": ["Zero capital outlay (no purchase order)"],
      "cons": ["Hospitals face 41.7% shortage during acute ICU emergencies"],
      "is_recommended": false,
      "action_proposals": []
    }
  ],
  "recommended_strategy_id": "STRAT-1-HOSPITAL-PRIORITY-PO",
  "executive_summary": "Simulation SIM-8F2B1C4D: Investigated Class II recall for Batch B2231. Outward exposure is 640 units. Net replacement deficit is 600 units. Strategy 1 is recommended to safeguard acute hospital care.",
  "assumptions": [
    "Hospital ICU departments have priority tier agreements.",
    "Supplier minimum order quantity (MOQ) is 500 units."
  ],
  "missing_data": [
    "Daily hospital bed occupancy telemetry pending integration."
  ],
  "clinical_safety_notice": "Arogya AI What-If Simulator provides operational projections only. Consequential actions require Qualified Person authorization."
}
```

**Stage Simulation Proposal Request (`POST /api/simulator/propose`):**
```json
{
  "simulation_id": "SIM-8F2B1C4D",
  "strategy_id": "STRAT-1-HOSPITAL-PRIORITY-PO",
  "strategy_name": "Strategy 1: Priority Hospital Defense & Emergency Supplier Order",
  "scenario_name": "Batch B2231 Recall & Multi-Strategy Replacement Analysis",
  "proposals": [
    {
      "action_type": "dispatch_hold",
      "title": "Recall Dispatch Freeze: Batch B2231",
      "target_entity": "Batch B2231",
      "rationale": "Regulatory containment.",
      "expected_impact": "Prevents compromised units from entering healthcare supply chain."
    }
  ]
}
```
**Response (200 OK):**
```json
{
  "success": true,
  "run_id": "RUN-SIM-9A3C1479",
  "created_proposal_ids": [15],
  "message": "Successfully staged 1 action proposal(s) for Qualified Person approval in the Approval Center.",
  "approval_center_url": "/approvals"
}
```

---

## 9. Automated Verification Suite & Test Report

Arogya AI features a comprehensive automated test suite consisting of **61 automated tests** with **100% pass rate**:

```
============================= test session starts ==============================
rootdir: /home/phoolghobhi/agentic-hackathon/backend
configfile: pytest.ini
collected 61 items

backend/tests/test_arogya.py ..............                              [ 23%]
backend/tests/test_dataset_integration.py .................              [ 51%]
backend/tests/test_health.py ..                                          [ 54%]
backend/tests/test_master_scenarios.py ....................              [ 87%]
backend/tests/test_simulator.py .....                                    [ 95%]
backend/tests/test_workflow.py ...                                       [100%]

============================= 61 passed in 82.96s ==============================
```

### Breakdown of Test Suites:

#### 1. `backend/tests/test_dataset_integration.py` (17 Dataset Integration & Master Prompt Tests)
- `test_dataset_exact_counts`: Rigorously asserts exact row counts for all 8 imported CSV datasets (`products`: 81, `customers`: 445, `suppliers`: 78, `batch_inventory`: 344, `dispatches`: 5,199, `purchase_orders`: 31, `recalls`: 2, `temperature_logs`: 1,012).
- `test_overdue_purchase_orders`: Verifies `PO-0688` overdue detection evaluated against snapshot date `2026-11-16`.
- `test_blocked_dispatch_for_recalled_stock`: Proves the system strictly denies outward dispatches of recalled batch `B2231` with `HTTP 403 Forbidden`.
- `test_cold_chain_excursion_audit`: Validates telemetry analysis identifying cold room `CR-02` thermal excursion (12.4°C) and co-located inventory.
- `test_agent_create_data_through_workspace`: Proves programmatic and cognitive data creation across batches, POs, temperatures, dispatches, customers, suppliers, and recalls.
- `test_twelve_master_questions` (12 parameterized tests): Evaluates the autonomous agent across all 12 core operational questions from the Master Specification:
  1. *"Which critical medicines are at risk of running out?"*
  2. *"Show all batches expiring within the next 60 days."*
  3. *"Which products have the highest dispatch demand?"*
  4. *"Is any recalled stock still available in Bengaluru?"*
  5. *"Which cold rooms recorded temperatures outside the permitted range?"*
  6. *"Which purchase orders are overdue?"*
  7. *"Can you identify products that need replenishment before the next delivery?"*
  8. *"Find the batches affected by the latest recall and check whether any were dispatched."*
  9. *"Compare insulin availability across all warehouses."*
  10. *"Why is this product being flagged as high risk?"*
  11. *"What should I prioritize today, and why?"*
  12. *"Explain the evidence behind your recommendation."*

#### 2. `backend/tests/test_master_scenarios.py` (20 Master Acceptance Scenarios)
- `test_scenario_01_unusual_wording_batch_investigation`: Natural language requests with non-standard phrasing correctly trigger batch investigation.
- `test_scenario_02_recall_blocks_batch_from_dispatch`: Quarantined batches are strictly blocked from outward dispatch with HTTP 403 Forbidden.
- `test_scenario_03_batch_traceability_recipients_and_quantities`: Forward trace segments Tier 1 hospitals from retail chemists with exact unit counts.
- `test_scenario_04_cold_chain_analysis_links_excursion_to_batches`: Thermal breaches in CR-02 isolate co-located biological lots without touching unaffected stock.
- `test_scenario_05_expiry_analysis_identifies_risk_and_assumptions`: Batches nearing expiry are flagged with days-to-expiry and FEFO queue order.
- `test_scenario_06_supplier_return_windows_calculated_from_terms`: Correctly audits expiring stock against contractual supplier return windows (MSAs).
- `test_scenario_07_critical_medicine_shortage_analysis`: Identifies demand velocity and flags formulations with <30 days runway.
- `test_scenario_08_replacement_coverage_recall_and_normal_demand`: Reconciles warehouse stock from dispatched stock; calculates net deficits against forecast demand.
- `test_scenario_09_agent_compares_feasible_operational_alternatives`: Generates at least two viable operational options with explicit trade-offs.
- `test_scenario_10_unapproved_action_does_not_mutate_state`: Proposals in `pending_review` do not mutate live stock.
- `test_scenario_11_rejected_action_does_not_execute`: Rejections record notes and leave stock unchanged.
- `test_scenario_12_bypass_dispatch_on_quarantined_batch_blocked`: Proves hard dispatch barrier blocks manual bypass attempts.
- `test_scenario_13_approved_execution_mutates_persistent_database_state`: Authorized Qualified Person sign-off executes state mutation and logs movement.
- `test_scenario_14_unsuccessful_operation_reported_as_failure`: Invalid actions report clear failures without state corruption.
- `test_scenario_15_unavailable_model_graceful_fallback`: System seamlessly falls back to the deterministic semantic engine if Ollama is offline.
- `test_scenario_16_unsupported_questions_truthful_response`: Non-operational queries receive honest boundaries rather than hallucinations.
- `test_scenario_17_follow_up_questions_retain_context`: Multi-turn context is maintained across follow-up queries.
- `test_scenario_18_empty_database_accurate_empty_states`: Zero-record tables render clean empty states rather than invented fake data.
- `test_scenario_19_concurrent_inventory_updates_consistency`: Concurrent updates maintain ledger consistency.
- `test_scenario_20_persistence_across_session_restart`: Database state persists across full service restarts.

#### 3. `backend/tests/test_simulator.py` (What-If Simulator Verification - 5 Tests)
- `test_simulator_isolation_proves_zero_mutations`: Proves simulations run strictly read-only against live tables with zero mutations across all 6 disruption scenarios.
- `test_b2231_recall_deterministic_math`: Proves dynamic calculation of B2231 outward units, 100% hospital defense, replacement deficit math, and MOQ compliance.
- `test_natural_language_scenario_parsing`: Proves entity and numeric parameter extraction from plain English prompts without false-positive keyword traps.
- `test_stage_proposal_creates_pending_review_and_executes_on_approval`: Proves staging creates an `ActionProposal` in `pending_review` requiring Qualified Person approval before executing real dispatch holds.
- `test_simulator_scenarios_and_explanation_endpoints`: Proves preset benchmark retrieval and local AI executive briefings.

#### 4. `backend/tests/test_arogya.py` (Domain Core Verification - 14 Tests)
- Verifies batch quantity reconciliation, replacement availability math, return window rules, temperature excursion detection, independent verification, and human approval gates.

#### 5. `backend/tests/test_workflow.py` & `test_health.py` (5 Tests)
- Verifies workflow execution engine and service health endpoints.

---

## 10. Installation, Configuration & Operational Guide

### 10.1 System Prerequisites
- **Operating System**: Linux (Ubuntu 20.04+ / Debian 11+ / Arch), macOS, or Windows WSL2
- **Python**: Version 3.10, 3.11, 3.12, 3.13, or 3.14
- **Node.js**: Version 18.0.0 or higher
- **Local AI (Recommended)**: [Ollama](https://ollama.ai) installed and running locally

---

### 10.2 Configuration Variables (`.env`)
Create `.env` in the `backend/` directory (or use `.env.example` template):

```bash
cp backend/.env.example backend/.env
```

| Environment Variable | Default Value | Description |
|---|---|---|
| `DATABASE_URL` | `sqlite:///./arogya.db` | Path to persistent SQLite database |
| `BUSINESS_REFERENCE_DATE` | `2026-11-16` | Reference date for PO overdue and expiry calculations |
| `AI_PROVIDER` | `ollama` | AI provider: `ollama`, `openai`, or `semantic` (deterministic offline fallback) |
| `AI_BASE_URL` | `http://localhost:11434/v1` | Local or remote inference endpoint |
| `AI_MODEL` | `qwen2.5-coder:7b` | Primary inference model name |
| `PORT` | `8000` | Backend API port |
| `CORS_ORIGINS` | `http://localhost:5173,...` | Allowed origins for React frontend |

---

### 10.3 Dataset Synchronization Pipeline
To import or re-synchronize all 8 CSV datasets from `07_pharma_distribution.zip`:

```bash
# Execute from project root or backend directory
python scripts/import_datasets.py
```

*Note: The synchronization pipeline is completely idempotent and safe to execute multiple times.*

---

### 10.4 Local AI Setup (Ollama & qwen2.5-coder:7b)

Arogya AI utilizes the user's local Ollama installation for private, zero-token clinical AI inference. Follow these steps to set up Ollama on your operating system:

#### Step 1: Install Ollama
- **macOS**: Install via Homebrew `brew install ollama` or download the installer from [ollama.com/download](https://ollama.com/download).
- **Linux**: Run the official installation script:
  ```bash
  curl -fsSL https://ollama.com/install.sh | sh
  ```
- **Windows**: Download and run `OllamaSetup.exe` from [ollama.com/download](https://ollama.com/download).

#### Step 2: Start Ollama Service
Ensure the Ollama background daemon is running:
```bash
ollama serve
```
By default, Ollama listens on `http://127.0.0.1:11434`.

#### Step 3: Pull the Required Model
Arogya AI is optimized for `qwen2.5-coder:7b`:
```bash
ollama pull qwen2.5-coder:7b
```

#### Step 4: Verify Local Ollama Health
Run a quick terminal test to verify the service and installed models:
```bash
# Check installed models via native Ollama API
curl -s http://127.0.0.1:11434/api/tags | grep -o "qwen2.5-coder:7b"
```
If `qwen2.5-coder:7b` appears in the output, local AI setup is complete.

---

### 10.5 Arogya Companion Helper (Optional Local Secure Bridge)

When accessing a public hosted instance (such as Vercel: `https://arogya-ai.vercel.app`), your browser may restrict direct HTTP communication from an HTTPS origin to `http://127.0.0.1:11434` due to Mixed Content or Private Network Access (PNA) security policies.

To enable local AI inference securely without lowering browser security settings, start the optional lightweight companion helper included in the repository:

#### Step 1: Start Companion Helper
```bash
# From repository root (uses standard library Python 3 — no pip dependencies required)
python3 scripts/arogya_companion.py
```
Output:
```
[Companion] Binding securely to loopback 127.0.0.1:11435
[Companion] Upstream Ollama target: http://127.0.0.1:11434
[Companion] Authorized origins: ['localhost', '127.0.0.1', '*.vercel.app']
[Companion] Ready. Listening on http://127.0.0.1:11435
```

#### Step 2: Run with TLS / SSL (For Strict Mixed-Content Browsers)
If your browser strictly rejects mixed HTTP content from HTTPS origins:
```bash
python3 scripts/arogya_companion.py --ssl
```
This automatically generates a transient loopback certificate and listens on `https://127.0.0.1:11435`.

#### Step 3: Verify Companion Health
```bash
curl -s http://127.0.0.1:11435/health
# Response: {"status":"ok","companion":"active","ollama_target":"http://127.0.0.1:11434"}
```

---

### 10.6 Browser Security & Troubleshooting Guide

| Issue / State | Root Cause | Resolution |
|---|---|---|
| **`AI: Offline` / `Mode: Dataset Fallback`** | Ollama is not installed or not running on port 11434. | Start Ollama with `ollama serve`. Arogya AI automatically detects when it starts; click **Retry Local AI Connection** in the header or modal. All dataset features remain 100% operational. |
| **`Model missing`** | Ollama is running, but `qwen2.5-coder:7b` has not been pulled. | In your terminal, run `ollama pull qwen2.5-coder:7b`. Then click **Retry Local AI Connection**. |
| **`Local connection blocked by browser security`** | The browser is blocking HTTPS-to-HTTP local loopback access (Mixed Content or Chrome Private Network Access). | Run `python3 scripts/arogya_companion.py`. Arogya AI will automatically detect the companion on port 11435. You do **not** need to disable browser flags. |
| **Backend Online vs AI Offline** | Backend and AI provider statuses are strictly decoupled. | The backend on Render is completely healthy; only local inference is offline. Dashboard metrics, inventory, batch numbers, and audit records will continue to work from real database records. |
| **Connection Timeout** | Local machine under heavy CPU/GPU load. | The local AI connection layer enforces a 3.5s timeout for health checks and 45s for inference. Adjust endpoint or timeout in **System Settings & Governance**. |

---

### 10.7 Backend Installation & Startup
```bash
# Navigate to backend directory
cd backend

# Create virtual environment
python3 -m venv .venv

# Activate virtual environment
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Start backend server with auto-reload
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
The backend initializes the SQLite database (`backend/arogya.db`), auto-migrates schemas, syncs datasets, and listens on `http://localhost:8000`.

---

### 10.8 Frontend Installation & Startup
```bash
# In a separate terminal, navigate to frontend directory
cd frontend

# Install npm dependencies
npm install

# Start Vite development server
npm run dev
```
Open your browser to `http://localhost:5173` to access the **Operations Control Centre**.

---

### 10.9 Automated Verification Suite (All 70 Pytest Checks)

Arogya AI features a comprehensive 70-test automated verification suite covering local AI connectivity, fallback mechanics, companion security, invariant enforcement, and supply chain workflows:

```bash
# Run full automated test suite (all 70 tests pass)
./.venv/bin/pytest backend/tests/ -v

# Run Local AI & Dataset Fallback test suite specifically
./.venv/bin/pytest backend/tests/test_local_ai_and_fallback.py -v

# Run Dataset Integration test suite
./.venv/bin/pytest backend/tests/test_dataset_integration.py -v

# Run What-If Simulator test suite
./.venv/bin/pytest backend/tests/test_simulator.py -v

# Verify frontend TypeScript build
cd frontend && npm run build
```

#### Test Suite Breakdown:
- **`test_local_ai_and_fallback.py` (9 tests)**: Mode A native Ollama connection, missing model detection, offline fallback activation, HTTP timeout safeguards, decoupled backend/AI health tracking, prompt output labeling, companion origin CORS restriction, and QP human approval gates.
- **`test_dataset_integration.py` (17 tests)**: Exact product, customer, supplier, and batch counts from canonical datasets; overdue PO detection; recall dispatch blocking; cold-chain audits; and 12 master natural language operational queries.
- **`test_master_scenarios.py` (20 tests)**: Regulatory recall blocks, forward/reverse traceability, thermal excursion logging, supplier return windows, shortage replan, zero unapproved mutation proofs, persistence across restarts.
- **`test_simulator.py` (5 tests)**: Sandbox zero-mutation invariants, deterministic mathematics, and scenario generation.
- **`test_workflow.py` (3 tests)**: SOP validation and execution.
- **`test_arogya.py` & `test_health.py` (16 tests)**: Core endpoints, QP approval workflows, and health probes.

---

## 11. Production Deployment Guide (Vercel + Render / Cloud)

### 11.1 Deployment Architecture: Why Frontend on Vercel & Backend on Render

Arogya AI is an enterprise-grade full-stack system with stateful pharmaceutical databases, long-running simulations, and Server-Sent Events (SSE). To ensure maximum reliability and prevent data loss, the recommended production architecture separates frontend and backend:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        PRODUCTION ARCHITECTURE                         │
├──────────────────────────────────┬─────────────────────────────────────┤
│ 🌐 FRONTEND: Vercel              │ ⚙️ BACKEND: Render / Cloud Host     │
├──────────────────────────────────┼─────────────────────────────────────┤
│ • React 19 + Vite 8 SPA          │ • FastAPI + Uvicorn Python runtime  │
│ • Global Edge CDN deployment     │ • Persistent process (no timeouts)  │
│ • Client-side routing rewrites   │ • Automatic dataset seeding & sync  │
│ • Fast builds (<1 sec)           │ • SSE stream (/api/agent/stream)    │
│ • Connects via VITE_API_URL      │ • Supports SQLite or PostgreSQL     │
└──────────────────────────────────┴─────────────────────────────────────┘
```

#### Why Not Run FastAPI Directly Inside Vercel Serverless?
1. **Read-Only / Ephemeral Filesystem**: Vercel Serverless Functions have a read-only root filesystem. The SQLite database cannot write persistent state. Any created batch, approved recall, or order proposal is wiped when the lambda instance terminates.
2. **Strict Timeouts**: Vercel functions time out after 10 seconds on the Hobby tier, prematurely killing dataset imports and deep multi-scenario simulations.
3. **Background Streams**: Live agent SSE streams require persistent connections not severed by lambda execution cutoffs.
4. **Local AI Daemon**: Ollama requires a long-running system daemon and GPU/RAM memory unavailable in serverless runtimes.

---

### 11.2 Frontend Deployment on Vercel (Step-by-Step)

The repository includes both root `vercel.json` and `frontend/vercel.json`, supporting two flexible deployment methods in the Vercel dashboard:

#### Method A: Monorepo Root Import (Recommended)
1. Go to [vercel.com/new](https://vercel.com/new) and connect your GitHub repository (`punitkr09/arogyaai`).
2. Keep **Root Directory** as `./` (the root).
3. Vercel automatically detects `vercel.json` at the root, which runs:
   - **Install Command**: `npm --prefix frontend install`
   - **Build Command**: `npm --prefix frontend run build`
   - **Output Directory**: `frontend/dist`
4. Expand **Environment Variables** and add:
   ```env
   VITE_API_URL=https://<your-backend-service>.onrender.com
   ```
5. Click **Deploy**. Your frontend is live with automatic SSL and SPA route fallback!

#### Method B: Subdirectory Import (`frontend`)
1. In the Vercel project configuration, set **Root Directory** to `frontend`.
2. Framework Preset: **Vite**.
3. Build Command: `npm run build`.
4. Output Directory: `dist`.
5. Under **Environment Variables**, set:
   ```env
   VITE_API_URL=https://<your-backend-service>.onrender.com
   ```
6. `frontend/vercel.json` ensures all deep link navigations rewrite cleanly to `/index.html`.

---

### 11.3 Backend Deployment on Render (Step-by-Step)

The backend can be deployed with one click using the included `render.yaml` blueprint or created manually as a Web Service.

#### Option 1: Render Blueprint (Infrastructure-as-Code)
1. Go to [dashboard.render.com](https://dashboard.render.com).
2. Click **New +** → **Blueprint**.
3. Connect your repository (`punitkr09/arogyaai`).
4. Render detects `render.yaml` and provisions the `arogyaai-backend` Web Service with all build and start commands configured automatically.
5. Click **Apply**.

#### Option 2: Manual Web Service Creation
1. Go to **New +** → **Web Service**.
2. Connect your GitHub repository.
3. Configure the service settings:
   - **Name**: `arogyaai-backend`
   - **Region**: Oregon (or nearest to your users)
   - **Runtime**: **Python 3**
   - **Build Command**:
     ```bash
     pip install -r backend/requirements.txt
     ```
   - **Start Command**:
     ```bash
     uvicorn app.main:app --app-dir backend --host 0.0.0.0 --port $PORT
     ```
   - **Health Check Path**: `/api/health`
4. Add Environment Variables in the Render dashboard:
   - `APP_ENV`: `production`
   - `CORS_ORIGIN_REGEX`: `^https:\/\/.*\.vercel\.app$`
   - `CORS_ORIGINS`: `https://<your-vercel-app>.vercel.app,http://localhost:5173`
   - `BUSINESS_REFERENCE_DATE`: `2026-11-16`
   - `AI_PROVIDER`: `ollama`
5. Click **Create Web Service**.
6. Note the public URL provided by Render (e.g., `https://arogyaai-backend.onrender.com`) and paste it as `VITE_API_URL` in your Vercel project settings.

---

### 11.4 Database Persistence: SQLite vs Managed PostgreSQL

Arogya AI ships with complete multi-database support built on SQLAlchemy:

#### Database Option 1: SQLite on Persistent Disk (Render Web Service)
If staying on SQLite without provisioning a separate PostgreSQL instance:
1. In Render Web Service settings, add a **Disk**:
   - **Name**: `arogya-data`
   - **Mount Path**: `/var/data`
   - **Size**: 1 GB
2. Set Environment Variable:
   ```env
   DATABASE_URL=sqlite:////var/data/arogya.db
   ```
3. Upon startup, Arogya AI creates `/var/data/arogya.db`, seeds tables, and synchronizes all 8 datasets from `backend/data/*.csv`.

#### Database Option 2: Managed PostgreSQL (Recommended for Production Scale)
1. Create a PostgreSQL database on Render, Supabase, Neon, or Railway.
2. Copy the connection URL and set `DATABASE_URL` in your backend environment:
   ```env
   DATABASE_URL=postgresql://user:password@host:5432/arogya_db
   ```
   *(Note: Arogya AI automatically converts legacy `postgres://` URLs to `postgresql://`)*
3. On first boot, `app/main.py` runs `Base.metadata.create_all(bind=engine)` and automatically populates all products, warehouses, customers, suppliers, inventory batches, and historical dispatches.

---

### 11.5 Local AI Privacy Architecture & Automatic Fallback (No Cloud AI Required)

Arogya AI is architected from the ground up to **never require a paid cloud-hosted AI model**:
- **Zero Cloud AI Dependency**: The entire application is 100% functional out of the box using canonical pharmaceutical datasets and deterministic business logic.
- **Client-Side Workstation Inference**: When local AI is enabled, the browser directly communicates with Ollama running locally on the operator's own workstation (`127.0.0.1:11434` or Companion Helper `127.0.0.1:11435`).
- **Complete Clinical Data Privacy**: Sensitive hospital ICU orders, patient-critical antibiotic distributions, and cold-chain temperature excursion alerts are **never sent to external cloud AI providers**.
- **Transparent Output Labeling**: Reports and agent dossiers explicitly disclose their generation mode:
  - Mode A: `[AI-Generated Reasoning — qwen2.5-coder:7b (Local Ollama)]`
  - Mode B: `[Dataset-Backed Deterministic Output — Verified Database Records]`
- **Decoupled Backend Health**: When Ollama is offline or uninstalled, the backend is **not** flagged as offline. The system reports `AI: Offline` and `Mode: Dataset Fallback` while the backend remains green and operational.

---

### 11.6 Complete Production Environment Variables Reference

#### Frontend (`frontend/.env` / Vercel Environment Variables):
| Variable | Required | Default | Description |
| :--- | :--- | :--- | :--- |
| `VITE_API_URL` | **Yes** (Prod) | `""` (proxies to `/api` locally) | Public backend URL (e.g. `https://arogyaai-backend.onrender.com`). |

#### User Workstation Settings (Configurable in UI via System Settings):
| Setting Key | Default | Description |
| :--- | :--- | :--- |
| `arogya_local_ai_endpoint` | `http://127.0.0.1:11434` | User's local native Ollama API endpoint. |
| `arogya_companion_endpoint` | `http://127.0.0.1:11435` | Local companion proxy endpoint for browser security / PNA bypass. |
| `arogya_local_ai_model` | `qwen2.5-coder:7b` | Preferred local LLM model for operations reasoning. |

#### Backend (`backend/.env` / Render Environment Variables):
| Variable | Required | Default | Description |
| :--- | :--- | :--- | :--- |
| `APP_ENV` | No | `production` | Environment profile (`production` / `development`). |
| `PORT` | Auto | `8000` | Port for Uvicorn server (automatically set by Render). |
| `HOST` | No | `0.0.0.0` | Bind host address. |
| `DATABASE_URL` | No | `sqlite:///./arogya.db` | SQLAlchemy connection string (SQLite or PostgreSQL). |
| `CORS_ORIGINS` | No | `http://localhost:5173,...` | Comma-separated list of allowed frontend domains. |
| `CORS_ORIGIN_REGEX` | No | `^https:\/\/.*\.vercel\.app$` | Regex allowing any Vercel production or preview URL. |
| `BUSINESS_REFERENCE_DATE`| No | `2026-11-16` | Business reference date matching supply-chain datasets. |
| `AI_PROVIDER` | No | `ollama` | Provider: `ollama` (default local), `openai`, or `semantic`. |
| `AI_BASE_URL` | No | `http://localhost:11434/v1` | Base URL for OpenAI-compatible completions API. |
| `AI_MODEL` | No | `qwen2.5-coder:7b` | Model name for chat and operational analysis. |
| `AI_TIMEOUT_SECONDS` | No | `45` | HTTP request timeout for model inference. |

---

### 11.7 Pre-Flight & Post-Deployment Verification Checklist

Before and after deployment, verify these checks:

- [x] **Frontend Production Build**: `npm --prefix frontend run build` completes with 0 errors.
- [x] **Backend Test Suite**: All 70 automated pytest checks pass (`pytest backend/tests`).
- [x] **Local AI Test Suite**: All 9 dedicated local AI & fallback checks pass (`pytest backend/tests/test_local_ai_and_fallback.py`).
- [x] **Backend Health Endpoint**: `GET /api/health` returns HTTP 200 with `status: "ok"`, independently tracking AI status.
- [x] **AI Status Endpoint**: `GET /api/ai/status` returns HTTP 200 with dynamic mode and model information.
- [x] **CORS Preflight**: OPTIONS request from `https://*.vercel.app` receives `Access-Control-Allow-Origin`.
- [x] **Companion Security**: Loopback binding and strict regex origin filtering verified.
- [x] **Data Reconciliation**: Backend imports 75 products, 420 customers, 75 suppliers, 338 batches, and 5,174 dispatches on first boot.
- [x] **SPA Route Rewrites**: Refreshing direct routes on Vercel serves `index.html` without 404 errors.
- [x] **Safety Gates**: All consequential database actions require human Qualified Person (QP) authorization.

---

### 11.8 Updating the Live Application via GitHub

Both Vercel and Render are integrated with your GitHub repository:

```bash
# Verify status and commit changes
git add .
git commit -m "feat: production deployment configuration for Vercel and Render"

# Push to your GitHub branch
git push origin arogyaai
```

Once pushed:
1. **Vercel** triggers an automatic build and deploys the new frontend in seconds.
2. **Render** pulls the updated commit, runs `pip install -r backend/requirements.txt`, and redeploys the backend zero-downtime service.

---

## License & Operational Compliance Notice

**Arogya AI** is engineered as an autonomous decision-support system. All operational actions affecting pharmaceutical lots, temperature holds, customer recall notifications, and emergency supplier purchase orders must be reviewed and authorized by an accredited human **Qualified Person (R.Ph / QP)** in accordance with regional pharmaceutical distribution governance standards.
