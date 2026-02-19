import { Hono } from "hono"
import * as eventService from "../services/eventService"

export const eventsRouter = new Hono()

eventsRouter.get("/", async (c) => {
  const taskId = c.req.param("taskId")
  if (!taskId) {
    return c.json({ error: "taskId is required" }, 400)
  }
  const events = await eventService.listTaskEvents(taskId)
  return c.json(events)
})
