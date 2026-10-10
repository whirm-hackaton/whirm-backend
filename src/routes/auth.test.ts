import { describe, expect, it, vi } from 'vitest'
import { createApp } from '../app.js'
import * as auth from '../services/auth.js'

vi.mock('../services/auth.js', async (importOriginal) => ({
  ...(await importOriginal<typeof auth>()),
  login: vi.fn(),
  getCurrentUser: vi.fn(),
  logout: vi.fn(),
}))

const user = {
  id: '71e1b2c3-47ad-426b-82d2-f2eb92232125',
  email: 'alice@example.test',
  displayName: 'Alice',
}
function setup(secure = false) {
  vi.clearAllMocks()
  vi.mocked(auth.login).mockResolvedValue({ user, token: 'test-session-token' })
  vi.mocked(auth.getCurrentUser).mockResolvedValue(user)
  vi.mocked(auth.logout).mockResolvedValue(undefined)
  return { service: auth, app: createApp(['http://localhost:5173'], secure) }
}
const login = (body: unknown, origin = 'http://localhost:5173') => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Origin: origin },
  body: JSON.stringify(body),
})
describe('authentication HTTP routes', () => {
  it('normalizes email, returns a public user and sets a secure cookie', async () => {
    const { app, service } = setup(true)
    const response = await app.request(
      '/auth/login',
      login({ email: ' ALICE@example.test ', password: 'secret' }),
    )
    expect(response.status).toBe(200)
    expect(service.login).toHaveBeenCalledWith('alice@example.test', 'secret')
    expect(await response.json()).toEqual({ user })
    const cookie = response.headers.get('set-cookie')
    for (const attribute of [
      'session=test-session-token',
      'HttpOnly',
      'Secure',
      'SameSite=Lax',
      'Path=/',
      'Max-Age=86400',
    ])
      expect(cookie).toContain(attribute)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(response.headers.get('access-control-allow-origin')).toBe(
      'http://localhost:5173',
    )
    expect(response.headers.get('access-control-allow-credentials')).toBe(
      'true',
    )
  })
  it('rejects invalid input before calling the service', async () => {
    const { app, service } = setup()
    const response = await app.request(
      '/auth/login',
      login({ email: 'bad', password: '' }),
    )
    expect(response.status).toBe(400)
    expect(service.login).not.toHaveBeenCalled()
  })
  it('rejects malformed JSON as a bad request', async () => {
    const { app, service } = setup()
    const response = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{',
    })
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Invalid request' })
    expect(service.login).not.toHaveBeenCalled()
  })
  it('hides database errors and does not issue a cookie on failure', async () => {
    const { app, service } = setup()
    vi.mocked(service.login).mockRejectedValue(new Error('database details'))
    const logger = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const response = await app.request(
        '/auth/login',
        login({ email: user.email, password: 'secret' }),
      )
      expect(response.status).toBe(500)
      expect(await response.json()).toEqual({ error: 'Internal server error' })
      expect(response.headers.get('set-cookie')).toBeNull()
    } finally {
      logger.mockRestore()
    }
  })
  it('returns a generic credentials error without a cookie', async () => {
    const { app, service } = setup()
    vi.mocked(service.login).mockResolvedValue(null)
    const response = await app.request(
      '/auth/login',
      login({ email: user.email, password: 'wrong' }),
    )
    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Invalid credentials' })
    expect(response.headers.get('set-cookie')).toBeNull()
  })
  it('returns the user for the current session', async () => {
    const { app, service } = setup()
    const response = await app.request('/auth/me', {
      headers: { Cookie: 'session=test-token' },
    })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ user })
    expect(service.getCurrentUser).toHaveBeenCalledWith('test-token')
  })
  it('rejects absent and invalid sessions', async () => {
    const { app, service } = setup()
    expect((await app.request('/auth/me')).status).toBe(401)
    expect(service.getCurrentUser).not.toHaveBeenCalled()
    vi.mocked(service.getCurrentUser).mockResolvedValue(null)
    expect(
      (
        await app.request('/auth/me', {
          headers: { Cookie: 'session=invalid' },
        })
      ).status,
    ).toBe(401)
  })
  it('revokes the current session and clears the cookie, even on repeated logout', async () => {
    const { app, service } = setup()
    const response = await app.request('/auth/logout', {
      method: 'POST',
      headers: { Cookie: 'session=test-token' },
    })
    expect(response.status).toBe(204)
    expect(service.logout).toHaveBeenCalledWith('test-token')
    expect(response.headers.get('set-cookie')).toContain('Max-Age=0')
    expect((await app.request('/auth/logout', { method: 'POST' })).status).toBe(
      204,
    )
    expect(service.logout).toHaveBeenCalledTimes(1)
  })
  it('rejects untrusted origins on both POST endpoints', async () => {
    const { app, service } = setup()
    expect(
      (
        await app.request(
          '/auth/login',
          login(
            { email: user.email, password: 'secret' },
            'https://other.example',
          ),
        )
      ).status,
    ).toBe(403)
    expect(
      (
        await app.request('/auth/logout', {
          method: 'POST',
          headers: { Origin: 'https://other.example' },
        })
      ).status,
    ).toBe(403)
    expect(service.login).not.toHaveBeenCalled()
    expect(service.logout).not.toHaveBeenCalled()
  })
  it('documents the routes and cookie authentication', async () => {
    const { app } = setup()
    const response = await app.request('/doc')
    const doc = (await response.json()) as {
      paths: Record<string, unknown>
      components: { securitySchemes: Record<string, unknown> }
    }
    expect(Object.keys(doc.paths)).toEqual(
      expect.arrayContaining(['/auth/login', '/auth/me', '/auth/logout']),
    )
    expect(doc.components.securitySchemes.sessionCookie).toEqual({
      type: 'apiKey',
      in: 'cookie',
      name: 'session',
    })
  })
})
