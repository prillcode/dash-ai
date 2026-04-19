import Database from "better-sqlite3"
import { drizzle } from "drizzle-orm/better-sqlite3"
import * as schema from "./schema"
import { mkdirSync } from "fs"
import path from "path"
import os from "os"

const dbPath = process.env.SQLITE_DB_PATH
  ? path.resolve(process.env.SQLITE_DB_PATH.replace(/^~/, os.homedir()))
  : path.join(os.homedir(), ".dash-ai", "dashboard.db")

// Ensure the directory exists before opening the database
mkdirSync(path.dirname(dbPath), { recursive: true })

const sqlite = new Database(dbPath)

// Enable WAL mode for better concurrent read performance
sqlite.pragma("journal_mode = WAL")

export const db = drizzle(sqlite, { schema })
