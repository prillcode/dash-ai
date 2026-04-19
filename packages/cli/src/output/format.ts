import chalk from "chalk"
import type { CliContext } from "../context"

export function formatJson(data: unknown): string {
  return JSON.stringify(data, null, 2)
}

/**
 * Wrap data in the standard success/error envelope.
 */
export function jsonEnvelope(data: unknown, success = true): object {
  if (success) {
    return { success: true, data }
  }
  return { success: false, error: data }
}

/**
 * Format an array of objects as an ASCII table.
 */
export function formatTable(headers: string[], rows: string[][]): string {
  const widths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => (r[i] ?? "").length))
  )
  const border = widths.map((w) => "─".repeat(w)).join("─┬─")
  const header = headers.map((h, i) => h.padEnd(widths[i])).join(" │ ")
  const lines = rows.map((row) =>
    row.map((cell, i) => (cell ?? "").padEnd(widths[i])).join(" │ ")
  )
  return [header, border, ...lines].join("\n")
}

/**
 * Format and print output based on CLI context.
 * If --json, prints JSON envelope. Otherwise, calls tableFormatter and prints the result.
 */
export function printOutput(
  ctx: CliContext,
  data: unknown,
  tableFormatter: () => string
): void {
  if (ctx.json) {
    console.log(formatJson(jsonEnvelope(data)))
  } else {
    console.log(tableFormatter())
  }
}

/**
 * Format a Unix timestamp or ISO string as a relative time.
 */
export function relativeTime(ts: string | Date): string {
  const date = typeof ts === "string" ? new Date(ts) : ts
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

/**
 * Truncate a string to maxLen with ellipsis.
 */
export function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str
  return str.slice(0, maxLen - 1) + "…"
}

/**
 * Print a success message (green).
 */
export function printSuccess(ctx: CliContext, msg: string): void {
  if (!ctx.quiet) console.log(chalk.green("✓"), msg)
}

/**
 * Print an error message (red) and exit with a code.
 */
export function printError(ctx: CliContext, msg: string, exitCode = 1): never {
  console.error(chalk.red("✗"), msg)
  process.exit(exitCode)
}

/**
 * Print a warning message (yellow).
 */
export function printWarn(ctx: CliContext, msg: string): void {
  if (!ctx.quiet) console.warn(chalk.yellow("⚠"), msg)
}

/**
 * Print an info message (blue).
 */
export function printInfo(ctx: CliContext, msg: string): void {
  if (!ctx.quiet) console.log(chalk.blue("ℹ"), msg)
}
