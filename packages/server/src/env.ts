import { config } from "dotenv"
import path from "path"
import { fileURLToPath } from "url"
import { homedir } from "os"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
config({ path: path.resolve(__dirname, "../../../.env") })

// Ensure the opencode CLI binary is on PATH regardless of how the server was started.
// The installer puts it at ~/.opencode/bin which may not be in the shell's PATH.
const opencodeBin = path.join(homedir(), ".opencode", "bin")
if (!process.env.PATH?.includes(opencodeBin)) {
  process.env.PATH = `${opencodeBin}:${process.env.PATH}`
}
