import { z } from '@hono/zod-openapi'

export const CreateWalletSchema = z
  .strictObject({
    address: z
      .string()
      .regex(/^0x[0-9a-fA-F]{40}$/)
      .transform((address) => address.toLowerCase()),
    chainId: z.literal(84532),
  })
  .openapi('CreateWallet')

export const WalletSchema = z
  .object({
    id: z.uuid(),
    userId: z.uuid(),
    address: z.string(),
    chainId: z.literal(84532),
    status: z.enum(['candidate', 'unverified', 'verified']),
    createdAt: z.iso.datetime(),
    verifiedAt: z.iso.datetime().nullable(),
  })
  .openapi('Wallet')

export const WalletResponseSchema = z
  .object({ wallet: WalletSchema })
  .openapi('WalletResponse')
export const WalletListSchema = z
  .object({ wallets: z.array(WalletSchema) })
  .openapi('WalletList')
export const WalletParamsSchema = z.object({ id: z.uuid() })
