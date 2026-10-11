import { OpenAPIHono } from '@hono/zod-openapi'
import { Scalar } from '@scalar/hono-api-reference'
import { cors } from 'hono/cors'
import { getCookie } from 'hono/cookie'
import { HTTPException } from 'hono/http-exception'
import type { MiddlewareHandler } from 'hono'

import health from './routes/health.js'
import auth from './routes/auth.js'
import wallets from './routes/wallets.js'
import { getCurrentUser, type AuthUser } from './services/auth.js'

export type AppEnv = { Variables: { user: AuthUser; secureCookies: boolean } }

export function createApp(corsOrigins: string[] = [], secureCookies = false) {
  const app = new OpenAPIHono<AppEnv>()

  app.onError((error, c) => {
    if (error instanceof HTTPException && error.status === 400)
      return c.json({ error: 'Invalid request' }, 400)

    console.error('API request failed')
    return c.json({ error: 'Internal server error' }, 500)
  })

  app.use('*', cors({ origin: corsOrigins, credentials: true }))

  const protect: MiddlewareHandler<AppEnv> = async (c, next) => {
    c.header('Cache-Control', 'no-store')
    c.set('secureCookies', secureCookies)

    if (c.req.path === '/wallet' || c.req.path.startsWith('/wallet/')) {
      const token = getCookie(c, 'session')
      const user = token ? await getCurrentUser(token) : null

      if (!user) return c.json({ error: 'Unauthenticated' }, 401)

      c.set('user', user)
    }

    const origin = c.req.header('Origin')

    if (
      ['POST', 'PUT'].includes(c.req.method) &&
      origin &&
      !corsOrigins.includes(origin)
    )
      return c.json({ error: 'Origin forbidden' }, 403)

    await next()
  }

  app.use('/auth/*', protect)
  app.use('/wallet/*', protect)

  app.route('/health', health)

  app.openAPIRegistry.registerComponent('securitySchemes', 'sessionCookie', {
    type: 'apiKey',
    in: 'cookie',
    name: 'session',
  })

  app.route('/auth', auth)
  app.route('/wallet', wallets)

  app.doc('/doc', {
    openapi: '3.0.0',
    info: { title: 'whirm-backend API', version: '0.1.0' },
  })
  app.get('/ui', Scalar({ url: '/doc', pageTitle: 'whirm-backend API' }))

  return app
}
