import { Hono } from "hono"
import { getModelRegistry, getAuth } from "../agent/piSession"
import type { Model, Api } from "@mariozechner/pi-ai"

export const modelsRouter = new Hono()

// Known provider display metadata
const PROVIDER_META: Record<string, { name: string; note?: string }> = {
  anthropic: { name: "Anthropic" },
  openai: { name: "OpenAI" },
  deepseek: { name: "DeepSeek" },
  google: { name: "Google" },
  "google-vertex": { name: "Google Vertex" },
  mistral: { name: "Mistral" },
  groq: { name: "Groq" },
  openrouter: { name: "OpenRouter" },
  zai: { name: "Z.AI" },
  ollama: { name: "Ollama (local)" },
  cerebras: { name: "Cerebras" },
  xai: { name: "xAI" },
}

interface ModelResponse {
  id: string
  name: string
  reasoning: boolean
  contextWindow: number
  maxTokens: number
  input: ("text" | "image")[]
  available: boolean
  cost: { input: number; output: number; cacheRead: number; cacheWrite: number }
}

interface ProviderResponse {
  id: string
  name: string
  models: ModelResponse[]
}

modelsRouter.get("/", async (c) => {
  try {
    const registry = getModelRegistry()
    const auth = getAuth()

    const allModels = registry.getAll()
    const available = registry.getAvailable()
    const availableKeys = new Set(available.map(m => `${m.provider}/${m.id}`))

    // Group all models by provider
    const byProvider = new Map<string, Model<Api>[]>()
    for (const model of allModels) {
      const existing = byProvider.get(model.provider) ?? []
      existing.push(model)
      byProvider.set(model.provider, existing)
    }

    const providers: ProviderResponse[] = []
    for (const [provider, models] of byProvider) {
      const meta = PROVIDER_META[provider] ?? { name: provider }
      const modelResponses: ModelResponse[] = models.map(m => ({
        id: m.id,
        name: m.name,
        reasoning: m.reasoning ?? false,
        contextWindow: m.contextWindow,
        maxTokens: m.maxTokens,
        input: m.input,
        available: availableKeys.has(`${m.provider}/${m.id}`),
        cost: m.cost,
      }))
      providers.push({ id: provider, name: meta.name, models: modelResponses })
    }

    // Sort providers: known ones first, then alphabetical
    const knownOrder = Object.keys(PROVIDER_META)
    providers.sort((a, b) => {
      const aIdx = knownOrder.indexOf(a.id)
      const bIdx = knownOrder.indexOf(b.id)
      if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx
      if (aIdx !== -1) return -1
      if (bIdx !== -1) return 1
      return a.name.localeCompare(b.name)
    })

    // Auth methods per provider
    const authMethods: Record<string, { type: string; configured: boolean }> = {}
    const allProviders = [...new Set(allModels.map(m => m.provider))]
    for (const p of allProviders) {
      const hasAuth = auth.hasAuth(p)
      // Determine auth type heuristically
      const envVarMap: Record<string, string> = {
        anthropic: "ANTHROPIC_API_KEY",
        openai: "OPENAI_API_KEY",
        deepseek: "DEEPSEEK_API_KEY",
        google: "GOOGLE_API_KEY",
        mistral: "MISTRAL_API_KEY",
        groq: "GROQ_API_KEY",
        zai: "ZAI_API_KEY",
        cerebras: "CEREBRAS_API_KEY",
        xai: "XAI_API_KEY",
      }
      const envVar = envVarMap[p] ?? `${p.toUpperCase()}_API_KEY`
      authMethods[p] = { type: hasAuth ? "configured" : "env_var", configured: hasAuth }
    }

    return c.json({ providers, authMethods })
  } catch (err: any) {
    return c.json({ providers: [], authMethods: {}, error: err.message }, 500)
  }
})
