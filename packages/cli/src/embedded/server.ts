import { spawn } from "child_process"
import { join, dirname } from "path"
import { fileURLToPath } from "url"
import { homedir } from "os"
import type { ChildProcess } from "child_process"

// Resolve the CLI package root (works when bundled or running source)
const __cliRoot = dirname(fileURLToPath(import.meta.url)).replace(/[/\\]dist$/, "")

let serverProcess: ChildProcess | null = null
let started = false

/**
 * Spin up the Dash AI server as a subprocess on a random port.
 * Uses the built dist if available, otherwise tsx + source.
 * Returns the server URL and auth token.
 */
export async function ensureEmbeddedServer(): Promise<{ url: string; token: string }> {
  if (started) {
    return {
      url: `http://localhost:${process.env.EMBEDDED_PORT ?? "3456"}`,
      token: process.env.API_TOKEN ?? "dev-token",
    }
  }

  const token = `cli-${Date.now()}-${Math.random().toString(36).slice(2)}`
  const port = String(3456 + Math.floor(Math.random() * 1000))
  // tsx lives in the CLI package's node_modules
  const tsxBin = join(__cliRoot, "node_modules/.bin/tsx")
  // Server source is alongside the CLI package
  const serverSrc = join(__cliRoot, "../server/src/index.ts")

  // Use the default DB path unless overridden; server reads SQLITE_DB_PATH from env
  process.env.EMBEDDED_PORT = port
  process.env.API_TOKEN = token

  // Use tsx for both dist and source — tsx handles ESM resolution cleanly
  const child = spawn(tsxBin, [serverSrc], {
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, PORT: port, API_TOKEN: token },
  })

  serverProcess = child

  child.stdout?.on("data", (data: Buffer) => {
    process.stdout.write(`[dash-ai-server] ${data.toString().trim()}\n`)
  })
  child.stderr?.on("data", (data: Buffer) => {
    process.stderr.write(`[dash-ai-server] ${data.toString().trim()}\n`)
  })
  child.on("error", (err) => process.stderr.write(`[dash-ai-server] ${err.message}\n`))

  started = true

  // Wait for server to be ready
  const url = `http://localhost:${port}`
  await waitForServer(url, 10_000)

  return { url, token }
}

/**
 * Poll /api/health until the server is ready, then resolve.
 */
async function waitForServer(url: string, timeout: number): Promise<void> {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${url}/api/health`)
      if (res.ok) return
    } catch { /* not ready */ }
    await new Promise((r) => setTimeout(r, 200))
  }
  throw new Error(`Server did not respond within ${timeout}ms`)
}

export async function teardownEmbeddedServer(): Promise<void> {
  if (serverProcess && !serverProcess.killed) {
    await new Promise<void>((res) => {
      serverProcess!.once("close", res)
      serverProcess!.kill("SIGTERM")
    })
  }
  serverProcess = null
  started = false
}

// Re-export so resolver.ts still works
void waitForServer
