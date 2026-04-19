import { contextBridge, ipcRenderer } from "electron"

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld("electronAPI", {
  // Server configuration
  getServerConfig: () => ipcRenderer.invoke("server:getConfig"),
  stopServer: () => ipcRenderer.invoke("server:stop"),

  // Platform info
  platform: process.platform,
})

// Type definitions for the renderer
declare global {
  interface Window {
    electronAPI: {
      getServerConfig: () => Promise<{ url: string; token: string }>
      stopServer: () => Promise<void>
      platform: string
    }
  }
}
