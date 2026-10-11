import type { LocalAIConfig, LocalAIState, LocalAIStatus } from '../types/arogya'

const DEFAULT_OLLAMA_URL = 'http://127.0.0.1:11434'
const DEFAULT_HELPER_URL = 'http://127.0.0.1:11435'
const DEFAULT_MODEL_NAME = 'qwen2.5-coder:7b'
const DEFAULT_TIMEOUT_MS = 3000

const STATE_LABELS: Record<LocalAIState, string> = {
  checking_local_ai: 'Checking local AI',
  local_ai_connected: 'Local AI connected',
  model_missing: 'Model missing',
  ollama_not_installed_or_not_running: 'Ollama not installed or not running',
  local_connection_blocked_by_browser_security: 'Local connection blocked by browser security',
  local_ai_request_failed: 'Local AI request failed',
  dataset_fallback_active: 'Dataset fallback active',
}

class LocalAiService {
  private config: LocalAIConfig
  private currentStatus: LocalAIStatus
  private listeners: Set<(status: LocalAIStatus) => void> = new Set()
  private pollTimer: number | null = null
  private activeBridgeUrl: string | null = null
  private isChecking = false

  constructor() {
    this.config = this.loadConfig()
    this.currentStatus = {
      state: 'checking_local_ai',
      stateLabel: STATE_LABELS.checking_local_ai,
      isOnline: false,
      modelAvailable: false,
      model: this.config.modelName,
      provider: 'ollama',
      endpointUrl: this.config.ollamaUrl,
      availableModels: [],
      message: 'Initializing local AI detection...',
      browserSecurityBlocked: false,
      helperAvailable: false,
      lastChecked: new Date().toISOString(),
    }
  }

  public loadConfig(): LocalAIConfig {
    const envOllama = (import.meta.env.VITE_OLLAMA_URL as string | undefined)?.trim()
    const envHelper = (import.meta.env.VITE_LOCAL_HELPER_URL as string | undefined)?.trim()
    const envModel = (import.meta.env.VITE_OLLAMA_MODEL as string | undefined)?.trim()

    const savedOllama = localStorage.getItem('arogya_ollama_url')?.trim()
    const savedHelper = localStorage.getItem('arogya_helper_url')?.trim()
    const savedModel = localStorage.getItem('arogya_ai_model')?.trim()

    return {
      ollamaUrl: savedOllama || envOllama || DEFAULT_OLLAMA_URL,
      helperUrl: savedHelper || envHelper || DEFAULT_HELPER_URL,
      modelName: savedModel || envModel || DEFAULT_MODEL_NAME,
      timeoutMs: DEFAULT_TIMEOUT_MS,
    }
  }

  public saveConfig(updated: Partial<LocalAIConfig>): void {
    this.config = { ...this.config, ...updated }
    if (updated.ollamaUrl) localStorage.setItem('arogya_ollama_url', updated.ollamaUrl)
    if (updated.helperUrl) localStorage.setItem('arogya_helper_url', updated.helperUrl)
    if (updated.modelName) localStorage.setItem('arogya_ai_model', updated.modelName)
    this.activeBridgeUrl = null
    this.checkConnection(true)
  }

  public getConfig(): LocalAIConfig {
    return { ...this.config }
  }

  public getStatus(): LocalAIStatus {
    return { ...this.currentStatus }
  }

  public subscribe(listener: (status: LocalAIStatus) => void): () => void {
    this.listeners.add(listener)
    listener(this.getStatus())
    return () => {
      this.listeners.delete(listener)
    }
  }

  private notify(status: LocalAIStatus) {
    this.currentStatus = status
    for (const listener of this.listeners) {
      try {
        listener(status)
      } catch (err) {
        console.error('LocalAiService listener error:', err)
      }
    }
  }

  public startBackgroundPolling(intervalMs = 30000): void {
    if (this.pollTimer) return
    this.checkConnection()
    this.pollTimer = window.setInterval(() => {
      // Don't poll aggressively if the window is hidden
      if (document.visibilityState === 'visible') {
        this.checkConnection()
      }
    }, intervalMs)
  }

  public stopBackgroundPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer)
      this.pollTimer = null
    }
  }

  public async checkConnection(force = false): Promise<LocalAIStatus> {
    if (this.isChecking && !force) {
      return this.currentStatus
    }
    this.isChecking = true

    const t0 = performance.now()
    const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:'

    this.notify({
      ...this.currentStatus,
      state: 'checking_local_ai',
      stateLabel: STATE_LABELS.checking_local_ai,
      message: 'Checking local Ollama service availability...',
      lastChecked: new Date().toISOString(),
    })

    // Try candidates in priority order:
    // 1. Direct Ollama URL
    // 2. Local Helper / Companion URL (if direct is blocked or helper configured)
    const candidates = [
      { url: this.config.ollamaUrl.replace(/\/+$/, ''), isHelper: false },
      { url: this.config.helperUrl.replace(/\/+$/, ''), isHelper: true },
    ]

    let reachableCandidate: { url: string; isHelper: boolean } | null = null
    let modelTagsResponse: { models?: Array<{ name?: string; model?: string }> } | null = null
    let browserSecurityBlocked = false
    let failureReason: 'security' | 'unreachable' | 'timeout' | 'error' = 'unreachable'
    let lastErrorMsg = ''

    for (const cand of candidates) {
      try {
        const controller = new AbortController()
        const timeoutId = window.setTimeout(() => controller.abort(), this.config.timeoutMs)

        const res = await fetch(`${cand.url}/api/tags`, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
          signal: controller.signal,
        })
        clearTimeout(timeoutId)

        if (res.ok) {
          const json = await res.json()
          reachableCandidate = cand
          modelTagsResponse = json
          break
        } else {
          lastErrorMsg = `HTTP ${res.status}: ${res.statusText}`
          failureReason = 'error'
        }
      } catch (err: unknown) {
        const errName = (err as Error)?.name || ''
        const errMsg = (err as Error)?.message || ''
        lastErrorMsg = errMsg

        if (errName === 'AbortError') {
          failureReason = 'timeout'
        } else if (isHttps && cand.url.startsWith('http://')) {
          // HTTPS page attempting to connect to HTTP loopback
          browserSecurityBlocked = true
          failureReason = 'security'
        } else if (errMsg.includes('Failed to fetch') || errMsg.includes('NetworkError') || errMsg.includes('CORS')) {
          if (isHttps) {
            browserSecurityBlocked = true
            failureReason = 'security'
          } else {
            failureReason = 'unreachable'
          }
        }
      }
    }

    const latencyMs = Math.round(performance.now() - t0)

    if (reachableCandidate && modelTagsResponse) {
      this.activeBridgeUrl = reachableCandidate.url
      const installedModels: string[] = (modelTagsResponse.models || [])
        .map((m) => m.name || m.model || '')
        .filter(Boolean)

      const targetModel = this.config.modelName.toLowerCase().trim()
      const isModelAvailable = installedModels.some((m) => {
        const mLower = m.toLowerCase()
        return (
          mLower === targetModel ||
          mLower.startsWith(`${targetModel}:`) ||
          targetModel.startsWith(`${mLower}:`) ||
          mLower.split(':')[0] === targetModel.split(':')[0]
        )
      })

      if (isModelAvailable) {
        const status: LocalAIStatus = {
          state: 'local_ai_connected',
          stateLabel: STATE_LABELS.local_ai_connected,
          isOnline: true,
          modelAvailable: true,
          model: this.config.modelName,
          provider: 'ollama',
          latencyMs,
          endpointUrl: reachableCandidate.url,
          availableModels: installedModels,
          message: `Connected to local Ollama (${latencyMs}ms)${reachableCandidate.isHelper ? ' via companion helper' : ''}. Model ${this.config.modelName} verified.`,
          browserSecurityBlocked: false,
          helperAvailable: reachableCandidate.isHelper,
          lastChecked: new Date().toISOString(),
        }
        this.isChecking = false
        this.notify(status)
        return status
      } else {
        const status: LocalAIStatus = {
          state: 'model_missing',
          stateLabel: STATE_LABELS.model_missing,
          isOnline: true,
          modelAvailable: false,
          model: this.config.modelName,
          provider: 'ollama',
          latencyMs,
          endpointUrl: reachableCandidate.url,
          availableModels: installedModels,
          message: `Ollama is running at ${reachableCandidate.url}, but configured model '${this.config.modelName}' is missing. Installed: [${installedModels.join(', ') || 'none'}].`,
          browserSecurityBlocked: false,
          helperAvailable: reachableCandidate.isHelper,
          lastChecked: new Date().toISOString(),
        }
        this.isChecking = false
        this.notify(status)
        return status
      }
    }

    // Connection failed -> Determine appropriate state
    this.activeBridgeUrl = null
    let finalState: LocalAIState = 'ollama_not_installed_or_not_running'
    let finalMessage = 'Ollama service is not reachable on 127.0.0.1:11434. Start Ollama to enable local AI assistance.'

    if (browserSecurityBlocked || failureReason === 'security') {
      finalState = 'local_connection_blocked_by_browser_security'
      finalMessage = isHttps
        ? 'Browser security policies (Mixed Content / Private Network Access) blocked direct HTTP access to 127.0.0.1 from this hosted HTTPS website. Run the Arogya companion helper or test locally.'
        : 'Local connection blocked by browser security or CORS policy.'
    } else if (failureReason === 'timeout') {
      finalState = 'local_ai_request_failed'
      finalMessage = `Local AI connection timed out after ${this.config.timeoutMs}ms.`
    } else if (failureReason === 'error') {
      finalState = 'local_ai_request_failed'
      finalMessage = `Local AI request failed: ${lastErrorMsg || 'Unknown error'}`
    }

    const status: LocalAIStatus = {
      state: finalState,
      stateLabel: STATE_LABELS[finalState],
      isOnline: false,
      modelAvailable: false,
      model: this.config.modelName,
      provider: 'ollama',
      latencyMs,
      endpointUrl: this.config.ollamaUrl,
      availableModels: [],
      message: finalMessage,
      browserSecurityBlocked,
      helperAvailable: false,
      lastChecked: new Date().toISOString(),
    }

    this.isChecking = false
    this.notify(status)
    return status
  }

  /**
   * Execute chat completion via the verified local Ollama instance.
   * Uses native Ollama /api/chat endpoint.
   */
  public async generateChatCompletion(
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    systemPrompt?: string,
    temperature = 0.2
  ): Promise<{ content: string; model: string; provider: string; raw: any }> {
    if (!this.currentStatus.isOnline || !this.currentStatus.modelAvailable) {
      throw new Error(`Local AI is offline or model is missing (${this.currentStatus.stateLabel}). Cannot execute local inference.`)
    }

    const bridgeUrl = this.activeBridgeUrl || this.config.ollamaUrl.replace(/\/+$/, '')
    const payloadMessages = []

    if (systemPrompt) {
      payloadMessages.push({ role: 'system', content: systemPrompt })
    }
    payloadMessages.push(...messages)

    const payload = {
      model: this.config.modelName,
      messages: payloadMessages,
      stream: false,
      options: {
        temperature,
      },
    }

    const controller = new AbortController()
    const timeoutId = window.setTimeout(() => controller.abort(), 60000)

    try {
      const res = await fetch(`${bridgeUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      })
      clearTimeout(timeoutId)

      if (!res.ok) {
        throw new Error(`Ollama chat returned HTTP ${res.status}: ${res.statusText}`)
      }

      const json = await res.json()
      const content = json?.message?.content || json?.response || ''

      return {
        content: content.trim(),
        model: this.config.modelName,
        provider: 'ollama',
        raw: json,
      }
    } catch (err: unknown) {
      clearTimeout(timeoutId)
      throw new Error(`Local inference failed: ${(err as Error)?.message || 'Unknown network error'}`)
    }
  }

  /**
   * Helper to generate text directly.
   */
  public async generateText(prompt: string, systemPrompt?: string): Promise<string> {
    const res = await this.generateChatCompletion([{ role: 'user', content: prompt }], systemPrompt)
    return res.content
  }
}

export const localAiService = new LocalAiService()
export { STATE_LABELS }
