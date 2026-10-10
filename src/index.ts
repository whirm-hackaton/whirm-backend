import { serve } from '@hono/node-server'
import { createApp } from './app.js'
import { env } from './lib/env.js'

const app = createApp(env.CORS_ORIGINS)
serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(`whirm-backend API: http://localhost:${info.port}`)
})
