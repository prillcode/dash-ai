export interface CliContext {
  json: boolean
  quiet: boolean
  color: boolean
  url?: string
  token?: string
}

export function getContext(opts: Record<string, unknown>): CliContext {
  return {
    json: (opts.json as boolean) ?? false,
    quiet: (opts.quiet as boolean) ?? false,
    color: (opts.color as boolean) ?? true,
    url: (opts.url as string | undefined) ?? process.env.DASH_AI_URL,
    token: (opts.token as string | undefined) ?? process.env.DASH_AI_TOKEN,
  }
}
