import { Hono } from "hono"
import { existsSync, readFileSync } from "fs"
import { join } from "path"
import os from "os"

export const modelsRouter = new Hono()

const DEFAULT_MODELS = {
  providers: [
    {
      id: "anthropic",
      name: "Anthropic",
       models: [
         { id: "claude-opus-4-5", name: "Claude Opus 4.5", note: "best for planning" },
         { id: "claude-sonnet-4-5", name: "Claude Sonnet 4.5", note: "best for coding" },
         { id: "claude-sonnet-4-6", name: "Claude Sonnet 4.6", note: "latest Sonnet model" },
         { id: "claude-haiku-3-5", name: "Claude Haiku 3.5", note: "fast + cheap" },
       ],
    },
    {
      id: "openai",
      name: "OpenAI",
      models: [
        { id: "o3", name: "o3", note: "best for planning" },
        { id: "gpt-4o", name: "GPT-4o", note: "fast + capable" },
      ],
    },
    {
      id: "deepseek",
      name: "DeepSeek",
      models: [
        { id: "deepseek-reasoner", name: "DeepSeek Reasoner", note: "strong reasoning model" },
        { id: "deepseek-chat", name: "DeepSeek Chat", note: "general coding model" },
      ],
    },
    {
      id: "zai",
      name: "Z.AI",
      models: [
        { id: "glm-4.7", name: "GLM 4.7", note: "Coding Plan model" },
      ],
    },
    {
      id: "ollama",
      name: "Ollama (local)",
      models: [
        { id: "qwen2.5-coder:32b", name: "Qwen 2.5 Coder 32B", note: "strong local coding model" },
        { id: "llama3.3:70b", name: "Llama 3.3 70B", note: "strong local general model" },
      ],
    },
  ],
}

modelsRouter.get("/", (c) => {
  const modelsPath = join(os.homedir(), ".ai-dashboard", "models.json")
  if (existsSync(modelsPath)) {
    try {
      const content = readFileSync(modelsPath, "utf-8")
      return c.json(JSON.parse(content))
    } catch {
      // Fall through to default
    }
  }
  return c.json(DEFAULT_MODELS)
})
