import { OpenAPIHono } from '@hono/zod-openapi'
import { Scalar } from '@scalar/hono-api-reference'
import { cors } from 'hono/cors'
import health from './routes/health.js'

export function createApp(corsOrigins: string[] = []) {
  const app = new OpenAPIHono()
  app.use('*', cors({ origin: corsOrigins, credentials: true }))
  app.route('/health', health)
  app.doc('/doc', {
    openapi: '3.0.0',
    info: { title: 'whirm-backend API', version: '0.1.0' },
  })
  app.get('/ui', Scalar({ url: '/doc', pageTitle: 'whirm-backend API' }))
  return app
}
