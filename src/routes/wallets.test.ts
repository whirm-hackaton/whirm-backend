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
  listWallets: vi.fn(),
  getWallet: vi.fn(),
  getVerifiedWallet: vi.fn(),
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
const post = (body: unknown) => ({
  method: 'POST',
  headers,
  body: JSON.stringify(body),
})
const app = createApp(['http://localhost:5173'])

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(getCurrentUser).mockResolvedValue(user)
  vi.mocked(service.createWallet).mockResolvedValue({ wallet, created: true })
  vi.mocked(service.listWallets).mockResolvedValue([])
  vi.mocked(service.getWallet).mockResolvedValue(null)
  vi.mocked(service.getVerifiedWallet).mockResolvedValue(null)
})

describe('wallet HTTP routes', () => {
  it('normalizes the address and creates a candidate for the session user', async () => {
    const response = await app.request(
      '/wallets',
      post({ address: `0x${'A'.repeat(40)}`, chainId: 84532 }),
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
          '/wallets',
          post({ address: wallet.address, chainId: 84532 }),
        )
      ).status,
    ).toBe(200)
    vi.mocked(service.createWallet).mockResolvedValue(null)
    const response = await app.request(
      '/wallets',
      post({ address: wallet.address, chainId: 84532 }),
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
    expect((await app.request('/wallets', post(body))).status).toBe(400)
    expect(service.createWallet).not.toHaveBeenCalled()
  })
  it('rejects malformed JSON and invalid identifiers', async () => {
    expect(
      (await app.request('/wallets', { method: 'POST', headers, body: '{' }))
        .status,
    ).toBe(400)
    expect((await app.request('/wallets/invalid', { headers })).status).toBe(
      400,
    )
    expect(service.getWallet).not.toHaveBeenCalled()
  })
  it('authenticates every endpoint before validation', async () => {
    for (const path of [
      '/wallets',
      '/wallets/verified',
      `/wallets/${wallet.id}`,
    ])
      expect((await app.request(path)).status).toBe(401)
    expect(
      (
        await app.request('/wallets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{',
        })
      ).status,
    ).toBe(401)
    vi.mocked(getCurrentUser).mockResolvedValue(null)
    expect((await app.request('/wallets', { headers })).status).toBe(401)
    expect(service.listWallets).not.toHaveBeenCalled()
  })
  it('lists only the current user wallets and returns 404 for missing or foreign wallets', async () => {
    expect(await (await app.request('/wallets', { headers })).json()).toEqual({
      wallets: [],
    })
    expect(service.listWallets).toHaveBeenCalledWith(user.id)
    expect(
      (await app.request(`/wallets/${wallet.id}`, { headers })).status,
    ).toBe(404)
    expect(service.getWallet).toHaveBeenCalledWith(user.id, wallet.id)
    vi.mocked(service.getWallet).mockResolvedValue(wallet)
    expect(
      (await app.request(`/wallets/${wallet.id}`, { headers })).status,
    ).toBe(200)
  })
  it('resolves verified as a static route and returns only a verified wallet', async () => {
    expect((await app.request('/wallets/verified', { headers })).status).toBe(
      404,
    )
    expect(service.getVerifiedWallet).toHaveBeenCalledWith(user.id)
    expect(service.getWallet).not.toHaveBeenCalled()
    vi.mocked(service.getVerifiedWallet).mockResolvedValue({
      ...wallet,
      status: 'verified',
      verifiedAt: new Date(),
    })
    expect((await app.request('/wallets/verified', { headers })).status).toBe(
      200,
    )
  })
  it('blocks foreign origins and hides internal errors', async () => {
    expect(
      (
        await app.request('/wallets', {
          ...post({ address: wallet.address, chainId: 84532 }),
          headers: { ...headers, Origin: 'https://other.example' },
        })
      ).status,
    ).toBe(403)
    expect(service.createWallet).not.toHaveBeenCalled()
    vi.mocked(service.listWallets).mockRejectedValue(
      new Error('database detail'),
    )
    const logger = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const response = await app.request('/wallets', { headers })
      expect(response.status).toBe(500)
      expect(await response.json()).toEqual({ error: 'Internal server error' })
    } finally {
      logger.mockRestore()
    }
  })
  it('documents all four authenticated routes', async () => {
    const doc = (await (await app.request('/doc')).json()) as {
      paths: Record<string, Record<string, { security: unknown }>>
    }
    for (const path of ['/wallets', '/wallets/{id}', '/wallets/verified']) {
      expect(doc.paths[path].get.security).toEqual([{ sessionCookie: [] }])
    }
    expect(doc.paths['/wallets'].post.security).toEqual([{ sessionCookie: [] }])
  })
  it('hides session lookup errors from app middleware', async () => {
    vi.mocked(getCurrentUser).mockRejectedValue(new Error('database detail'))
    const logger = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const response = await app.request('/wallets', { headers })
      expect(response.status).toBe(500)
      expect(await response.json()).toEqual({ error: 'Internal server error' })
      expect(response.headers.get('cache-control')).toBe('no-store')
    } finally {
      logger.mockRestore()
    }
  })
})
