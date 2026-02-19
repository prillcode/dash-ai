import { Context, Next } from "hono"

export async function loggerMiddleware(c: Context, next: Next) {
  const start = Date.now()
  const method = c.req.method
  const path = c.req.path
  
  await next()
  
  const duration = Date.now() - start
  console.log(`${method} ${path} - ${c.res.status} (${duration}ms)`)
}
