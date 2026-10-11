import { createRoute, OpenAPIHono } from '@hono/zod-openapi'
import { AuthErrorSchema } from '../schemas/auth.js'
import { CreateWalletSchema, WalletResponseSchema } from '../schemas/wallets.js'
import type { AppEnv } from '../app.js'
import { createWallet, getWallet } from '../services/wallets.js'
import type { wallets } from '../db/schema.js'

const errorResponse = (description: string) => ({
  description,
  content: { 'application/json': { schema: AuthErrorSchema } },
})
const success = {
  description: 'Wallet metadata',
  content: { 'application/json': { schema: WalletResponseSchema } },
}
const errors = {
  400: errorResponse('Invalid request'),
  401: errorResponse('Unauthenticated'),
  500: errorResponse('Internal server error'),
}
const metadata = { tags: ['Wallets'], security: [{ sessionCookie: [] }] }
const serialize = (wallet: typeof wallets.$inferSelect) => ({
  ...wallet,
  chainId: wallet.chainId as 84532,
  status: wallet.status as 'candidate' | 'unverified' | 'verified',
  createdAt: wallet.createdAt.toISOString(),
  verifiedAt: wallet.verifiedAt?.toISOString() ?? null,
})

const routes = new OpenAPIHono<AppEnv>({
  defaultHook: (result, c) => {
    if (!result.success) return c.json({ error: 'Invalid request' }, 400)
  },
})

routes.openapi(
  createRoute({
    ...metadata,
    method: 'put',
    path: '/',
    request: {
      body: {
        required: true,
        content: { 'application/json': { schema: CreateWalletSchema } },
      },
    },
    responses: {
      ...errors,
      200: success,
      201: success,
      403: errorResponse('Origin forbidden'),
      409: errorResponse(
        'User already has a wallet or address already associated',
      ),
    },
  }),
  async (c) => {
    const { address, chainId } = c.req.valid('json')
    const result = await createWallet(c.get('user').id, address, chainId)
    if (!result) return c.json({ error: 'Wallet already associated' }, 409)
    return c.json(
      { wallet: serialize(result.wallet) },
      result.created ? 201 : 200,
    )
  },
)

routes.openapi(
  createRoute({
    ...metadata,
    method: 'get',
    path: '/',
    responses: {
      ...errors,
      200: success,
      404: errorResponse('Wallet not found'),
    },
  }),
  async (c) => {
    const wallet = await getWallet(c.get('user').id)
    return wallet
      ? c.json({ wallet: serialize(wallet) }, 200)
      : c.json({ error: 'Wallet not found' }, 404)
  },
)

export default routes
