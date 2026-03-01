import { defineConfig } from "drizzle-kit"
import { config } from "dotenv"
import path from "path"
import os from "os"

config({ path: path.resolve(__dirname, "../../.env") })

const dbPath = process.env.SQLITE_DB_PATH
  ? path.resolve(process.env.SQLITE_DB_PATH.replace(/^~/, os.homedir()))
  : path.join(os.homedir(), ".dash-ai", "dashboard.db")

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  dialect: "sqlite",
  dbCredentials: {
    url: dbPath,
  },
})
