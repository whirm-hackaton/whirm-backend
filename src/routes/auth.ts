import { createRoute, OpenAPIHono } from '@hono/zod-openapi'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { HTTPException } from 'hono/http-exception'
import {
  AuthErrorSchema,
  AuthResponseSchema,
  LoginSchema,
} from '../schemas/auth.js'
import {
  login,
  getCurrentUser,
  logout,
  sessionLifetime,
} from '../services/auth.js'

const jsonError = (description: string) => ({
  description,
  content: { 'application/json': { schema: AuthErrorSchema } },
})
const success = {
  description: 'Authenticated user',
  content: { 'application/json': { schema: AuthResponseSchema } },
}

export function createAuthRoutes(origins: string[], secure: boolean) {
  const auth = new OpenAPIHono({
    defaultHook: (result, c) => {
      if (!result.success) return c.json({ error: 'Invalid request' }, 400)
    },
  })
  const cookieOptions = {
    httpOnly: true,
    secure,
    sameSite: 'Lax' as const,
    path: '/',
  }
  auth.use('*', async (c, next) => {
    c.header('Cache-Control', 'no-store')
    const origin = c.req.header('Origin')
    if (c.req.method === 'POST' && origin && !origins.includes(origin))
      return c.json({ error: 'Origin forbidden' }, 403)
    await next()
  })
  auth.onError((error, c) => {
    if (error instanceof HTTPException && error.status === 400) {
      return c.json({ error: 'Invalid request' }, 400)
    }
    console.error('Authentication request failed', error)
    return c.json({ error: 'Internal server error' }, 500)
  })
  auth.openapi(
    createRoute({
      method: 'post',
      path: '/login',
      tags: ['Auth'],
      request: {
        body: {
          required: true,
          content: { 'application/json': { schema: LoginSchema } },
        },
      },
      responses: {
        200: success,
        400: jsonError('Invalid request'),
        401: jsonError('Invalid credentials'),
        403: jsonError('Origin forbidden'),
        500: jsonError('Internal server error'),
      },
    }),
    async (c) => {
      const { email, password } = c.req.valid('json')
      const result = await login(email, password)
      if (!result) return c.json({ error: 'Invalid credentials' }, 401)
      setCookie(c, 'session', result.token, {
        ...cookieOptions,
        maxAge: sessionLifetime,
      })
      return c.json({ user: result.user }, 200)
    },
  )
  auth.openapi(
    createRoute({
      method: 'get',
      path: '/me',
      tags: ['Auth'],
      security: [{ sessionCookie: [] }],
      responses: {
        200: success,
        401: jsonError('Unauthenticated'),
        500: jsonError('Internal server error'),
      },
    }),
    async (c) => {
      const token = getCookie(c, 'session')
      const user = token ? await getCurrentUser(token) : null
      if (!user) return c.json({ error: 'Unauthenticated' }, 401)
      return c.json({ user }, 200)
    },
  )
  auth.openapi(
    createRoute({
      method: 'post',
      path: '/logout',
      tags: ['Auth'],
      responses: {
        204: { description: 'Logged out' },
        403: jsonError('Origin forbidden'),
        500: jsonError('Internal server error'),
      },
    }),
    async (c) => {
      const token = getCookie(c, 'session')
      if (token) await logout(token)
      deleteCookie(c, 'session', cookieOptions)
      return c.body(null, 204)
    },
  )
  return auth
}
