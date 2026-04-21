import { Hono } from "hono"
import { z } from "zod"
import * as settingsService from "../services/settingsService"
import { getModelRegistry } from "../agent/piSession"

export const settingsRouter = new Hono()

const updateSettingsSchema = z.object({
  // AI Provider defaults
  defaultProvider: z.string().optional(),
  defaultModel: z.string().optional(),

  // Persona defaults
  defaultPlannerPersonaId: z.string().optional(),
  defaultCoderPersonaId: z.string().optional(),

  // Project defaults
  defaultProjectId: z.string().optional(),

  // Workflow automation
  autoStartPlanning: z.boolean().optional(),
  planningMode: z.enum(["auto", "fast", "full"]).optional(),
  planningAllowRelatedWorkItems: z.boolean().optional(),
  planningThinkingLevel: z.enum(["low", "medium", "high"]).optional(),
  codingThinkingLevel: z.enum(["low", "medium", "high"]).optional(),

  // UI preferences
  uiTheme: z.enum(["dark", "light", "system"]).optional(),
  confirmDestructiveActions: z.boolean().optional(),

  // Agent.md generation
  agentMdPrompt: z.string().max(5000).optional(),
})

/**
 * GET /api/settings
 * Returns all settings as a JSON object
 */
settingsRouter.get("/", async (c) => {
  const settings = await settingsService.getDefaultSettings()
  return c.json(settings)
})

/**
 * PATCH /api/settings
 * Update settings (partial update)
 * Validates that provider/model are valid options
 */
settingsRouter.patch("/", async (c) => {
  const body = await c.req.json()
  const parsed = updateSettingsSchema.safeParse(body)

  if (!parsed.success) {
    return c.json({ error: "Invalid request body", details: parsed.error.errors }, 400)
  }

  const { defaultProvider, defaultModel } = parsed.data

  // Validate provider if provided
  if (defaultProvider) {
    const registry = getModelRegistry()
    const allModels = registry.getAll()
    const providerIds = [...new Set(allModels.map(m => m.provider))]
    
    if (!providerIds.includes(defaultProvider)) {
      return c.json(
        { error: `Invalid provider: ${defaultProvider}. Available: ${providerIds.join(", ")}` },
        400
      )
    }
  }

  // Validate model if provided
  if (defaultModel && defaultProvider) {
    const registry = getModelRegistry()
    const allModels = registry.getAll()
    const providerModels = allModels.filter(m => m.provider === defaultProvider)
    const modelIds = providerModels.map(m => m.id)
    
    if (!modelIds.includes(defaultModel)) {
      return c.json(
        { 
          error: `Invalid model: ${defaultModel} for provider ${defaultProvider}. ` +
                 `Available: ${modelIds.join(", ")}` 
        },
        400
      )
    }
  }

  // Update settings
  const updated = await settingsService.updateSettings({
    ...(defaultProvider && { defaultProvider }),
    ...(defaultModel && { defaultModel }),
    ...(parsed.data.defaultPlannerPersonaId && { defaultPlannerPersonaId: parsed.data.defaultPlannerPersonaId }),
    ...(parsed.data.defaultCoderPersonaId && { defaultCoderPersonaId: parsed.data.defaultCoderPersonaId }),
    ...(parsed.data.defaultProjectId && { defaultProjectId: parsed.data.defaultProjectId }),
    ...(parsed.data.autoStartPlanning !== undefined && { autoStartPlanning: parsed.data.autoStartPlanning }),
    ...(parsed.data.planningMode && { planningMode: parsed.data.planningMode }),
    ...(parsed.data.planningAllowRelatedWorkItems !== undefined && { planningAllowRelatedWorkItems: parsed.data.planningAllowRelatedWorkItems }),
    ...(parsed.data.planningThinkingLevel && { planningThinkingLevel: parsed.data.planningThinkingLevel }),
    ...(parsed.data.codingThinkingLevel && { codingThinkingLevel: parsed.data.codingThinkingLevel }),
    ...(parsed.data.uiTheme && { uiTheme: parsed.data.uiTheme }),
    ...(parsed.data.confirmDestructiveActions !== undefined && { confirmDestructiveActions: parsed.data.confirmDestructiveActions }),
    ...(parsed.data.agentMdPrompt !== undefined && { agentMdPrompt: parsed.data.agentMdPrompt }),
  })

  return c.json(updated)
})
