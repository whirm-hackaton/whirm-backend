import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp } from '../app.js'
import { getCurrentUser } from '../services/auth.js'
import * as service from '../services/wallets.js'

vi.mock('../services/auth.js', async (original) => ({
  ...(await original<typeof import('../services/auth.js')>()),
  getCurrentUser: vi.fn(),
}))
vi.mock('../services/wallets.js', () => ({
  createWallet: vi.fn(),
  getWallet: vi.fn(),
}))

const user = {
  id: '71e1b2c3-47ad-426b-82d2-f2eb92232125',
  email: 'alice@example.test',
  displayName: 'Alice',
}
const wallet = {
  id: 'b2027308-9f19-46ec-8e87-5d3b6308dd12',
  userId: user.id,
  address: `0x${'a'.repeat(40)}`,
  chainId: 84532,
  status: 'candidate',
  createdAt: new Date(),
  verifiedAt: null,
}
const headers = { Cookie: 'session=test', 'Content-Type': 'application/json' }
const put = (body: unknown) => ({
  method: 'PUT',
  headers,
  body: JSON.stringify(body),
})
const app = createApp(['http://localhost:5173'])

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(getCurrentUser).mockResolvedValue(user)
  vi.mocked(service.createWallet).mockResolvedValue({ wallet, created: true })
  vi.mocked(service.getWallet).mockResolvedValue(null)
})

describe('wallet HTTP routes', () => {
  it('normalizes the address and creates a candidate for the session user', async () => {
    const response = await app.request(
      '/wallet',
      put({ address: `0x${'A'.repeat(40)}`, chainId: 84532 }),
    )
    expect(response.status).toBe(201)
    expect(service.createWallet).toHaveBeenCalledWith(
      user.id,
      wallet.address,
      84532,
    )
    expect(await response.json()).toEqual({
      wallet: { ...wallet, createdAt: wallet.createdAt.toISOString() },
    })
    expect(response.headers.get('cache-control')).toBe('no-store')
  })
  it('returns 200 for a repeat and a generic 409 for a foreign association', async () => {
    vi.mocked(service.createWallet).mockResolvedValue({
      wallet,
      created: false,
    })
    expect(
      (
        await app.request(
          '/wallet',
          put({ address: wallet.address, chainId: 84532 }),
        )
      ).status,
    ).toBe(200)
    vi.mocked(service.createWallet).mockResolvedValue(null)
    const response = await app.request(
      '/wallet',
      put({ address: wallet.address, chainId: 84532 }),
    )
    expect(response.status).toBe(409)
    expect(await response.json()).toEqual({
      error: 'Wallet already associated',
    })
  })
  it.each([
    { address: 'bad', chainId: 84532 },
    { address: wallet.address, chainId: 1 },
    { address: wallet.address, chainId: '84532' },
    { address: wallet.address, chainId: 84532, status: 'verified' },
    { address: wallet.address, chainId: 84532, userId: user.id },
    { address: wallet.address, chainId: 84532, privateKey: 'secret' },
  ])('rejects invalid input: %j', async (body) => {
    expect((await app.request('/wallet', put(body))).status).toBe(400)
    expect(service.createWallet).not.toHaveBeenCalled()
  })
  it('rejects malformed JSON', async () => {
    expect(
      (await app.request('/wallet', { method: 'PUT', headers, body: '{' }))
        .status,
    ).toBe(400)
    expect(service.createWallet).not.toHaveBeenCalled()
  })
  it('authenticates GET and PUT before validation', async () => {
    expect((await app.request('/wallet')).status).toBe(401)
    expect(
      (
        await app.request('/wallet', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: '{',
        })
      ).status,
    ).toBe(401)
    vi.mocked(getCurrentUser).mockResolvedValue(null)
    expect((await app.request('/wallet', { headers })).status).toBe(401)
    expect(service.getWallet).not.toHaveBeenCalled()
  })
  it('returns the current user wallet or 404 when none exists', async () => {
    expect((await app.request('/wallet', { headers })).status).toBe(404)
    expect(service.getWallet).toHaveBeenCalledWith(user.id)
    vi.mocked(service.getWallet).mockResolvedValue(wallet)
    const response = await app.request('/wallet', { headers })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      wallet: { ...wallet, createdAt: wallet.createdAt.toISOString() },
    })
  })
  it('blocks foreign origins and hides internal errors', async () => {
    expect(
      (
        await app.request('/wallet', {
          ...put({ address: wallet.address, chainId: 84532 }),
          headers: { ...headers, Origin: 'https://other.example' },
        })
      ).status,
    ).toBe(403)
    expect(service.createWallet).not.toHaveBeenCalled()
    vi.mocked(service.getWallet).mockRejectedValue(new Error('database detail'))
    const logger = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const response = await app.request('/wallet', { headers })
      expect(response.status).toBe(500)
      expect(await response.json()).toEqual({ error: 'Internal server error' })
    } finally {
      logger.mockRestore()
    }
  })
  it('documents only GET and PUT for the current wallet', async () => {
    const doc = (await (await app.request('/doc')).json()) as {
      paths: Record<string, Record<string, { security: unknown }>>
    }
    expect(Object.keys(doc.paths['/wallet']).sort()).toEqual(['get', 'put'])
    for (const method of ['get', 'put'])
      expect(doc.paths['/wallet'][method].security).toEqual([
        { sessionCookie: [] },
      ])
    expect(doc.paths['/wallets']).toBeUndefined()
  })
  it('hides session lookup errors from app middleware', async () => {
    vi.mocked(getCurrentUser).mockRejectedValue(new Error('database detail'))
    const logger = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const response = await app.request('/wallet', { headers })
      expect(response.status).toBe(500)
      expect(await response.json()).toEqual({ error: 'Internal server error' })
      expect(response.headers.get('cache-control')).toBe('no-store')
    } finally {
      logger.mockRestore()
    }
  })
})
