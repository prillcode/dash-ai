import { defineConfig } from "drizzle-kit"
import { config } from "dotenv"
import path from "path"

config({ path: path.resolve(__dirname, "../../.env") })

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  dialect: "turso",
  dbCredentials: {
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN,
  },
})
