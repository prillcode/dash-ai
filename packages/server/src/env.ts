import { config } from "dotenv"
import path from "path"
import { fileURLToPath } from "url"
import { homedir } from "os"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
config({ path: path.resolve(__dirname, "../../../.env") })

// Ensure the pi binary is on PATH regardless of how the server was started.
const piBin = path.join(homedir(), ".pi", "bin")
if (!process.env.PATH?.includes(piBin)) {
  process.env.PATH = `${piBin}:${process.env.PATH}`
}
