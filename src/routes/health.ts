import { createRoute, OpenAPIHono } from '@hono/zod-openapi'
import { HealthResponseSchema } from '../schemas/health.js'

const health = new OpenAPIHono()

health.openapi(
  createRoute({
    method: 'get',
    path: '/',
    tags: ['Health'],
    summary: 'Health check',
    responses: {
      200: {
        description: 'Server is healthy',
        content: { 'application/json': { schema: HealthResponseSchema } },
      },
    },
  }),
  (c) => c.json({ status: 'ok' as const }, 200),
)

export default health
