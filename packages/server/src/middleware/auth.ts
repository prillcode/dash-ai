import { Context, Next } from "hono"

const validToken = process.env.API_TOKEN

export async function authMiddleware(c: Context, next: Next) {
  if (c.req.path === "/api/health") {
    return next()
  }
  
  const authHeader = c.req.header("Authorization")
  
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return c.json({ error: "Missing or invalid Authorization header" }, 401)
  }
  
  const token = authHeader.slice(7)
  
  if (token !== validToken) {
    return c.json({ error: "Invalid API token" }, 401)
  }
  
  return next()
}
