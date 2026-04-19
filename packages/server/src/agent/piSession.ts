import { AuthStorage, ModelRegistry } from "@mariozechner/pi-coding-agent"
import type { Model, Api } from "@mariozechner/pi-ai"

let authStorage: AuthStorage | undefined
let modelRegistry: ModelRegistry | undefined

/**
 * Get or create the shared AuthStorage singleton.
 * Uses Pi's default file-based backend (~/.pi/agent/auth.json),
 * with env var fallback (ANTHROPIC_API_KEY, OPENAI_API_KEY, etc.).
 */
export function getAuth(): AuthStorage {
  if (!authStorage) authStorage = AuthStorage.create()
  return authStorage
}

/**
 * Get or create the shared ModelRegistry singleton.
 * Loads built-in models + custom models from ~/.pi/agent/models.json.
 */
export function getModelRegistry(): ModelRegistry {
  if (!modelRegistry) modelRegistry = ModelRegistry.create(getAuth())
  return modelRegistry
}

/**
 * Check whether a provider has credentials configured.
 * This is a fast check that doesn't refresh OAuth tokens.
 */
export async function checkProviderAuth(providerID: string): Promise<{ ok: boolean; errorMessage?: string }> {
  const registry = getModelRegistry()
  const available = await registry.getAvailable()
  const found = available.some(m => m.provider === providerID)
  if (!found) {
    return {
      ok: false,
      errorMessage: `No API key for provider "${providerID}". Set the appropriate env var (e.g. ANTHROPIC_API_KEY) or run 'pi' and use /login.`,
    }
  }
  return { ok: true }
}

/**
 * Resolve a model by provider and model ID.
 * Throws with a clear error if not found or no API key.
 */
export async function resolveModel(provider: string, modelId: string): Promise<Model<Api>> {
  const registry = getModelRegistry()
  const model = registry.find(provider, modelId)
  if (!model) throw new Error(`Model not found: ${provider}/${modelId}. Check that the model ID is correct and the provider is configured.`)
  return model
}

/**
 * Validate a persona's model/provider configuration against Pi's registry.
 * Returns { valid: true } if the model exists. Returns { valid: false, message }
 * with a suggestion if the model is not found. Does NOT block on API key availability
 * (API keys may not be configured yet — the runner's auth pre-flight catches that at runtime).
 */
export function validatePersonaModel(input: {
  provider?: string
  model?: string
}): { valid: boolean; message?: string; suggestion?: string } {
  const provider = input.provider || "anthropic"
  const modelId = input.model || "claude-sonnet-4-5"

  const registry = getModelRegistry()
  const model = registry.find(provider, modelId)

  if (!model) {
    // Try to find models for the same provider as a suggestion
    const allModels = registry.getAll().filter(m => m.provider === provider)
    const suggestion = allModels.length > 0
      ? `Available models for "${provider}": ${allModels.map(m => m.id).join(", ")}`
      : `No models found for provider "${provider}". Check your API key configuration.`

    return {
      valid: false,
      message: `Model "${modelId}" is not registered for provider "${provider}".`,
      suggestion,
    }
  }

  return { valid: true }
}
