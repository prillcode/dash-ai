import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useSettings, useUpdateSettings } from "../api/settings"
import { usePersonas } from "../api/personas"
import { useProjects } from "../api/projects"
import { useModels } from "../api/personas"
import { Button, Spinner } from "../components/ui"

export function SettingsPage() {
  const navigate = useNavigate()
  const { data: settings, isLoading: isLoadingSettings } = useSettings()
  const { data: modelsData } = useModels()
  const { data: personas } = usePersonas()
  const { data: projects } = useProjects()
  const updateSettings = useUpdateSettings()

  // Local form state
  const [formState, setFormState] = useState({
    defaultProvider: "",
    defaultModel: "",
    defaultPlannerPersonaId: "",
    defaultCoderPersonaId: "",
    defaultProjectId: "",
    autoStartPlanning: false,
    uiTheme: "dark" as "dark" | "light" | "system",
    confirmDestructiveActions: true,
  })

  // Track if form is dirty
  const [isDirty, setIsDirty] = useState(false)
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "success" | "error">("idle")

  // Load settings into form when data arrives
  useEffect(() => {
    if (settings) {
      setFormState({
        defaultProvider: settings.defaultProvider || "",
        defaultModel: settings.defaultModel || "",
        defaultPlannerPersonaId: settings.defaultPlannerPersonaId || "",
        defaultCoderPersonaId: settings.defaultCoderPersonaId || "",
        defaultProjectId: settings.defaultProjectId || "",
        autoStartPlanning: settings.autoStartPlanning || false,
        uiTheme: settings.uiTheme || "dark",
        confirmDestructiveActions: settings.confirmDestructiveActions !== false,
      })
      setIsDirty(false)
    }
  }, [settings])

  // Get configured providers
  const configuredProviders = modelsData?.providers.filter(
    (p) => modelsData.authMethods[p.id]?.configured
  ) || []

  // Get models for selected provider
  const selectedProvider = configuredProviders.find((p) => p.id === formState.defaultProvider)
  const availableModels = selectedProvider?.models || []

  // Get planner and coder personas
  const plannerPersonas = personas?.filter((p) => p.personaType === "planner" && p.isActive) || []
  const coderPersonas = personas?.filter((p) => p.personaType === "coder" && p.isActive) || []

  // Handle provider change - cascade to first model
  const handleProviderChange = (providerId: string) => {
    const provider = configuredProviders.find((p) => p.id === providerId)
    const firstModel = provider?.models[0]?.id || ""
    setFormState((prev) => ({
      ...prev,
      defaultProvider: providerId,
      defaultModel: firstModel,
    }))
    setIsDirty(true)
  }

  // Handle field changes
  const handleChange = (field: keyof typeof formState, value: string | boolean) => {
    setFormState((prev) => ({ ...prev, [field]: value }))
    setIsDirty(true)
  }

  // Handle save
  const handleSave = async () => {
    setSaveStatus("saving")
    try {
      await updateSettings.mutateAsync({
        defaultProvider: formState.defaultProvider || undefined,
        defaultModel: formState.defaultModel || undefined,
        defaultPlannerPersonaId: formState.defaultPlannerPersonaId || undefined,
        defaultCoderPersonaId: formState.defaultCoderPersonaId || undefined,
        defaultProjectId: formState.defaultProjectId || undefined,
        autoStartPlanning: formState.autoStartPlanning,
        uiTheme: formState.uiTheme,
        confirmDestructiveActions: formState.confirmDestructiveActions,
      })
      setSaveStatus("success")
      setIsDirty(false)
      setTimeout(() => setSaveStatus("idle"), 2000)
    } catch (err) {
      setSaveStatus("error")
      setTimeout(() => setSaveStatus("idle"), 3000)
    }
  }

  // Handle cancel
  const handleCancel = () => {
    navigate(-1)
  }

  if (isLoadingSettings) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text">Settings</h1>
        <p className="text-muted">Configure default values for personas, tasks, and UI preferences.</p>
      </div>

      <div className="space-y-8">
        {/* Section 1: AI Provider Defaults */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-text border-b border-border pb-2">
            AI Provider Defaults
          </h2>
          
          <div className="space-y-1">
            <label className="block text-sm font-medium text-muted">Default Provider</label>
            {configuredProviders.length === 0 ? (
              <div className="text-sm text-danger">
                No providers configured. Add API keys to ~/.pi/agent/auth.json or set environment variables.
              </div>
            ) : (
              <select
                value={formState.defaultProvider}
                onChange={(e) => handleProviderChange(e.target.value)}
                className="form-input w-full px-3 py-2 text-sm"
              >
                <option value="">Select a provider...</option>
                {configuredProviders.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-muted">Default Model</label>
            <select
              value={formState.defaultModel}
              onChange={(e) => handleChange("defaultModel", e.target.value)}
              disabled={!formState.defaultProvider || availableModels.length === 0}
              className="form-input w-full px-3 py-2 text-sm disabled:opacity-50"
            >
              <option value="">
                {!formState.defaultProvider
                  ? "Select a provider first"
                  : availableModels.length === 0
                  ? "No models available"
                  : "Select a model..."}
              </option>
              {availableModels.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                  {m.note ? ` (${m.note})` : ""}
                </option>
              ))}
            </select>
          </div>
        </section>

        {/* Section 2: Default Personas */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-text border-b border-border pb-2">
            Default Personas
          </h2>
          
          <div className="space-y-1">
            <label className="block text-sm font-medium text-muted">Default Planner Persona</label>
            <select
              value={formState.defaultPlannerPersonaId}
              onChange={(e) => handleChange("defaultPlannerPersonaId", e.target.value)}
              className="form-input w-full px-3 py-2 text-sm"
            >
              <option value="">Select a planner persona...</option>
              {plannerPersonas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-subtle">
              Pre-selected when creating new tasks. Only active planner personas are shown.
            </p>
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-muted">Default Coder Persona</label>
            <select
              value={formState.defaultCoderPersonaId}
              onChange={(e) => handleChange("defaultCoderPersonaId", e.target.value)}
              className="form-input w-full px-3 py-2 text-sm"
            >
              <option value="">Select a coder persona...</option>
              {coderPersonas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-subtle">
              Pre-selected when creating new tasks. Only active coder personas are shown.
            </p>
          </div>
        </section>

        {/* Section 3: Project Defaults */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-text border-b border-border pb-2">
            Project Defaults
          </h2>
          
          <div className="space-y-1">
            <label className="block text-sm font-medium text-muted">Default Project</label>
            <select
              value={formState.defaultProjectId}
              onChange={(e) => handleChange("defaultProjectId", e.target.value)}
              className="form-input w-full px-3 py-2 text-sm"
            >
              <option value="">Select a project...</option>
              {projects?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-subtle">
              Pre-selected when creating new tasks.
            </p>
          </div>
        </section>

        {/* Section 4: Workflow */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-text border-b border-border pb-2">
            Workflow Automation
          </h2>
          
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={formState.autoStartPlanning}
              onChange={(e) => handleChange("autoStartPlanning", e.target.checked)}
              className="w-4 h-4 rounded border-border text-accent focus:ring-accent"
            />
            <span className="text-sm text-text">Auto-start planning when creating new tasks</span>
          </label>
          <p className="text-xs text-subtle ml-7">
            Immediately triggers AI planning after task creation, skipping the draft state.
          </p>
        </section>

        {/* Section 5: UI Preferences */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-text border-b border-border pb-2">
            UI Preferences
          </h2>
          
          <div className="space-y-1">
            <label className="block text-sm font-medium text-muted">UI Theme</label>
            <select
              value={formState.uiTheme}
              onChange={(e) => handleChange("uiTheme", e.target.value as "dark" | "light" | "system")}
              className="form-input w-full px-3 py-2 text-sm"
            >
              <option value="dark">Dark</option>
              <option value="light">Light (coming soon)</option>
              <option value="system">System (coming soon)</option>
            </select>
            <p className="text-xs text-subtle">
              Currently only dark mode is fully implemented.
            </p>
          </div>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={formState.confirmDestructiveActions}
              onChange={(e) => handleChange("confirmDestructiveActions", e.target.checked)}
              className="w-4 h-4 rounded border-border text-accent focus:ring-accent"
            />
            <span className="text-sm text-text">Confirm destructive actions</span>
          </label>
          <p className="text-xs text-subtle ml-7">
            Show confirmation dialogs before deleting personas, tasks, or regenerating Agent.md files.
          </p>
        </section>

        {/* Actions */}
        <div className="flex items-center gap-4 pt-4 border-t border-border">
          <Button
            variant="primary"
            onClick={handleSave}
            disabled={!isDirty || saveStatus === "saving"}
          >
            {saveStatus === "saving" ? (
              <span className="flex items-center gap-2">
                <Spinner size="sm" /> Saving...
              </span>
            ) : (
              "Save Settings"
            )}
          </Button>
          
          <Button variant="secondary" onClick={handleCancel}>
            Cancel
          </Button>

          {saveStatus === "success" && (
            <span className="text-sm text-success">Settings saved!</span>
          )}
          
          {saveStatus === "error" && (
            <span className="text-sm text-danger">Failed to save. Please try again.</span>
          )}
        </div>
      </div>
    </div>
  )
}
