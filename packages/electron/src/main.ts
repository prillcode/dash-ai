import { app, BrowserWindow, ipcMain, Menu } from "electron"
import { spawn } from "child_process"
import { delimiter, join } from "path"
import { homedir } from "os"
import { createServer } from "http"
import { readFile } from "fs"
import { lookup } from "mime-types"
import { config } from "dotenv"

function getClientDistPath(): string {
  return app.isPackaged
    ? join(process.resourcesPath, "client", "dist")
    : join(__dirname, "../../client/dist")
}

function getServerEntryPath(): { command: string; args: string[]; env: NodeJS.ProcessEnv } {
  if (app.isPackaged) {
    return {
      command: process.execPath,
      args: [join(process.resourcesPath, "server", "dist", "index.js")],
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: "1",
        NODE_PATH: [
          join(process.resourcesPath, "app.asar", "node_modules"),
          process.env.NODE_PATH,
        ]
          .filter(Boolean)
          .join(delimiter),
      },
    }
  }

  return {
    command: join(__dirname, "../../cli/node_modules/.bin/tsx"),
    args: [join(__dirname, "../../server/src/index.ts")],
    env: { ...process.env },
  }
}

// Load .env file for API keys
config({ path: join(homedir(), ".dash-ai", ".env") })

// Disable GPU for headless/CI environments
app.commandLine.appendSwitch("disable-gpu")
app.commandLine.appendSwitch("disable-software-rasterizer")
app.commandLine.appendSwitch("no-sandbox")
app.commandLine.appendSwitch("disable-dev-shm-usage")
app.commandLine.appendSwitch("no-zygote")
app.commandLine.appendSwitch("in-process-gpu")
app.commandLine.appendSwitch("disable-features", "IsolateOrigins,site-per-process")
app.commandLine.appendSwitch("disable-site-isolation-trials")
app.commandLine.appendSwitch("max-old-space-size", "4096")

// Keep a global reference of the window object
let mainWindow: BrowserWindow | null = null
let serverProcess: ReturnType<typeof spawn> | null = null
let staticServer: ReturnType<typeof createServer> | null = null
let staticServerPort: number | null = null

// API Server configuration
let serverUrl: string | null = null
let serverToken: string | null = null

function generateToken(): string {
  return `electron-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

// Start a simple HTTP server to serve the React client static files
function startStaticServer(apiPort: number, apiToken: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const clientDist = getClientDistPath()
    
    staticServer = createServer((req, res) => {
      const url = req.url || "/"
      
      // Proxy API requests to the API server
      if (url.startsWith("/api/") || url.startsWith("/ws/")) {
        // Node lowercases headers, but check both cases
        const authHeader = req.headers.authorization || req.headers.Authorization
        
        // Create clean headers object
        const headers: Record<string, string> = {}
        
        // Copy important headers
        if (req.headers['content-type']) {
          headers['Content-Type'] = req.headers['content-type'] as string
        }
        if (req.headers['content-length']) {
          headers['Content-Length'] = req.headers['content-length'] as string
        }
        if (req.headers['accept']) {
          headers['Accept'] = req.headers['accept'] as string
        }
        
        // Always use our token - ignore browser's auth header
        if (apiToken) {
          headers['Authorization'] = `Bearer ${apiToken}`
        }
        
        const options = {
          hostname: "127.0.0.1",
          port: apiPort,
          path: url,
          method: req.method,
          headers,
        }
        
        const proxyReq = require("http").request(options, (proxyRes: any) => {
          res.writeHead(proxyRes.statusCode, proxyRes.headers)
          proxyRes.pipe(res)
        })
        
        proxyReq.on("error", (err: Error) => {
          console.error("[proxy] Error:", err.message)
          res.writeHead(502)
          res.end("Bad Gateway")
        })
        
        req.pipe(proxyReq)
        return
      }
      
      let pathname = url
      if (pathname === "/") pathname = "/index.html"
      
      const filePath = join(clientDist, pathname)
      
      readFile(filePath, (err, data) => {
        if (err) {
          // Fallback to index.html for SPA routing
          readFile(join(clientDist, "index.html"), (err2, data2) => {
            if (err2) {
              res.writeHead(404)
              res.end("Not found")
            } else {
              res.writeHead(200, { "Content-Type": "text/html" })
              res.end(data2)
            }
          })
        } else {
          const mimeType = lookup(filePath) || "application/octet-stream"
          res.writeHead(200, { "Content-Type": mimeType })
          res.end(data)
        }
      })
    })
    
    staticServer.listen(0, "127.0.0.1", () => {
      const addr = staticServer?.address()
      if (addr && typeof addr === "object") {
        staticServerPort = addr.port
        resolve(staticServerPort)
      } else {
        reject(new Error("Failed to get server port"))
      }
    })
  })
}

async function startEmbeddedServer(): Promise<{ url: string; token: string }> {
  if (serverUrl && serverToken) {
    return { url: serverUrl, token: serverToken }
  }

  const token = generateToken()
  serverToken = token

  const serverRuntime = getServerEntryPath()

  const env = {
    ...serverRuntime.env,
    PORT: "0", // Random port
    API_TOKEN: token,
    SQLITE_DB_PATH: join(homedir(), ".dash-ai", "dashboard.db"),
    NODE_ENV: "production",
  }

  console.log("[electron] Starting API server...")
  console.log("[electron] Using token:", token.slice(0, 8) + "...")
  
  serverProcess = spawn(
    serverRuntime.command,
    serverRuntime.args,
    {
      env,
      stdio: ["ignore", "pipe", "pipe"],
    }
  )
  
  // Log process events for debugging
  serverProcess.on("spawn", () => {
    console.log("[electron] API server process started (PID:", serverProcess?.pid, ")")
  })

  // Capture server URL from stdout
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Server failed to start within 30s"))
    }, 30000)

    const onData = (data: Buffer) => {
      const line = data.toString()
      
      // Parse "Dash AI server running on http://localhost:PORT"
      const match = line.match(/running on (http:\/\/localhost:\d+)/)
      if (match) {
        clearTimeout(timeout)
        serverUrl = match[1]
        serverProcess?.stdout?.off("data", onData)
        resolve({ url: serverUrl, token })
      }
    }

    serverProcess?.stdout?.on("data", onData)
    serverProcess?.stderr?.on("data", (data) => {
      const line = data.toString().trim()
      // Log errors and important messages
      if (line.includes("Error") || line.includes("error") || line.includes("FATAL")) {
        console.error("[server ERROR]", line)
      }
    })

    serverProcess?.on("error", (err) => {
      clearTimeout(timeout)
      reject(err)
    })

    serverProcess?.on("exit", (code) => {
      if (code !== 0 && code !== null) {
        console.error(`[electron] API server exited with code ${code}`)
      }
    })
  })
}

async function stopEmbeddedServer() {
  if (serverProcess) {
    serverProcess.kill("SIGTERM")
    serverProcess = null
  }
  if (staticServer) {
    staticServer.close()
    staticServer = null
  }
  serverUrl = null
  serverToken = null
}

function createWindow(clientPort: number) {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
    titleBarStyle: "hiddenInset",
  })

  // Remove the menu bar (File, Edit, View, etc.)
  Menu.setApplicationMenu(null)

  // Load the React app from local static server
  const loadUrl = process.env.VITE_DEV_SERVER_URL || `http://127.0.0.1:${clientPort}`
  mainWindow.loadURL(loadUrl)
  
  // Open DevTools for debugging (disable in production)
  if (process.env.NODE_ENV === "development" || process.env.DEBUG) {
    mainWindow.webContents.openDevTools()
  }
  
  // Log load errors for debugging
  mainWindow.webContents.on("did-fail-load", (_event, errorCode, errorDescription) => {
    console.error("Failed to load:", errorCode, errorDescription)
  })

  mainWindow.on("closed", () => {
    mainWindow = null
  })
}

// IPC handlers
ipcMain.handle("server:getConfig", async () => {
  const { url, token } = await startEmbeddedServer()
  return { url, token }
})

ipcMain.handle("server:stop", async () => {
  await stopEmbeddedServer()
})

// App lifecycle
app.whenReady().then(async () => {
  try {
    // Start the API server first to get its port and token
    const { url: apiUrl } = await startEmbeddedServer()
    const apiPort = parseInt(new URL(apiUrl).port, 10)
    
    // Start static server with API proxy (pass the token)
    const clientPort = await startStaticServer(apiPort, serverToken!)
    
    // Create window after both servers are ready
    createWindow(clientPort)
  } catch (err) {
    console.error("Failed to start:", err)
    app.quit()
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0 && staticServerPort) {
      createWindow(staticServerPort)
    }
  })
})

app.on("window-all-closed", async () => {
  await stopEmbeddedServer()
  if (process.platform !== "darwin") {
    app.quit()
  }
})

app.on("before-quit", async () => {
  await stopEmbeddedServer()
})
