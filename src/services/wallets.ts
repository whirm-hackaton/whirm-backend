import { and, eq } from 'drizzle-orm'
import { wallets } from '../db/schema.js'

export async function createWallet(
  userId: string,
  address: string,
  chainId: number,
) {
  const { db } = await import('../db/pool.js')
  const [created] = await db
    .insert(wallets)
    .values({ userId, address, chainId })
    .onConflictDoNothing()
    .returning()
  if (created) return { wallet: created, created: true }
  const [existing] = await db
    .select()
    .from(wallets)
    .where(and(eq(wallets.address, address), eq(wallets.chainId, chainId)))
    .limit(1)
  if (!existing || existing.userId !== userId) return null
  return { wallet: existing, created: false }
}

export async function getWallet(
  userId: string,
): Promise<typeof wallets.$inferSelect | null> {
  const { db } = await import('../db/pool.js')
  const [wallet] = await db
    .select()
    .from(wallets)
    .where(eq(wallets.userId, userId))
    .limit(1)
  return wallet ?? null
}
