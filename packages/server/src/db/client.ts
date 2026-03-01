import Database from "better-sqlite3"
import { drizzle } from "drizzle-orm/better-sqlite3"
import * as schema from "./schema"
import path from "path"
import os from "os"

const dbPath = process.env.SQLITE_DB_PATH
  ? path.resolve(process.env.SQLITE_DB_PATH.replace(/^~/, os.homedir()))
  : path.join(os.homedir(), ".dash-ai", "dashboard.db")

// Ensure the directory exists before opening the database
import { mkdirSync, existsSync, writeFileSync } from "fs"
mkdirSync(path.dirname(dbPath), { recursive: true })

// Write default models.json if it doesn't exist
const modelsJsonPath = path.join(os.homedir(), ".dash-ai", "models.json")
if (!existsSync(modelsJsonPath)) {
  const defaultModels = {
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
  writeFileSync(modelsJsonPath, JSON.stringify(defaultModels, null, 2))
}

const sqlite = new Database(dbPath)

// Enable WAL mode for better concurrent read performance
sqlite.pragma("journal_mode = WAL")

export const db = drizzle(sqlite, { schema })
