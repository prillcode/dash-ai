import { app, BrowserWindow, ipcMain, protocol } from "electron"
import { spawn } from "child_process"
import { join } from "path"
import { homedir } from "os"
import { readFile } from "fs/promises"
import { fileURLToPath } from "url"

// Keep a global reference of the window object
let mainWindow: BrowserWindow | null = null
let serverProcess: ReturnType<typeof spawn> | null = null

// Server configuration
const SERVER_PORT = 0 // 0 = random available port
let serverUrl: string | null = null
let serverToken: string | null = null

// Protocol for serving client files
const PROTOCOL = "dashai"

// Register protocol to serve client files
function registerProtocol() {
  protocol.registerFileProtocol(PROTOCOL, async (request, callback) => {
    const url = new URL(request.url)
    let pathname = url.pathname
    
    // Default to index.html for root
    if (pathname === "/") {
      pathname = "/index.html"
    }
    
    // Serve from client dist
    const clientDist = join(__dirname, "../../client/dist")
    const filePath = join(clientDist, pathname)
    
    try {
      // Check if file exists
      await readFile(filePath)
      callback(filePath)
    } catch {
      // Fallback to index.html for SPA routing
      callback(join(clientDist, "index.html"))
    }
  })
}

function generateToken(): string {
  return `electron-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

async function startEmbeddedServer(): Promise<{ url: string; token: string }> {
  if (serverUrl && serverToken) {
    return { url: serverUrl, token: serverToken }
  }

  const token = generateToken()
  serverToken = token

  // Use tsx to run the server source directly
  const serverSrc = join(__dirname, "../../server/src/index.ts")
  const tsxBin = join(__dirname, "../../cli/node_modules/.bin/tsx")

  // Alternative: use built dist if available
  const serverDist = join(__dirname, "../server/dist/index.js")
  const useDist = false // prefer tsx for development

  const env = {
    ...process.env,
    PORT: "0", // Random port
    API_TOKEN: token,
    SQLITE_DB_PATH: join(homedir(), ".dash-ai", "dashboard.db"),
    NODE_ENV: "production",
  }

  serverProcess = spawn(
    useDist ? process.execPath : tsxBin,
    useDist ? [serverDist] : [serverSrc],
    {
      env,
      stdio: ["ignore", "pipe", "pipe"],
    }
  )

  // Capture server URL from stdout
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Server failed to start within 30s"))
    }, 30000)

    const onData = (data: Buffer) => {
      const line = data.toString()
      console.log("[server]", line.trim())

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
      console.error("[server err]", data.toString().trim())
    })

    serverProcess?.on("error", (err) => {
      clearTimeout(timeout)
      reject(err)
    })

    serverProcess?.on("exit", (code) => {
      if (code !== 0 && code !== null) {
        console.error(`Server exited with code ${code}`)
      }
    })
  })
}

async function stopEmbeddedServer() {
  if (serverProcess) {
    serverProcess.kill("SIGTERM")
    serverProcess = null
  }
  serverUrl = null
  serverToken = null
}

function createWindow() {
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

  // Load the React app
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
    mainWindow.webContents.openDevTools()
  } else {
    // In production, serve via custom protocol
    mainWindow.loadURL(`${PROTOCOL}://dashai/`)
  }

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
  // Register custom protocol for serving client files
  registerProtocol()

  // Start the embedded server first
  try {
    await startEmbeddedServer()
    createWindow()
  } catch (err) {
    console.error("Failed to start server:", err)
    app.quit()
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
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
