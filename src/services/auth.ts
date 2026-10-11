import { createHash, randomBytes } from 'node:crypto'
import { and, eq, gt, isNull } from 'drizzle-orm'
import { sessions, users } from '../db/schema.js'
import { hashPassword, verifyPassword } from '../lib/password.js'

export const sessionLifetime = 24 * 60 * 60
export type AuthUser = { id: string; email: string; displayName: string }
const publicUser = {
  id: users.id,
  email: users.email,
  displayName: users.displayName,
}
const tokenHash = (token: string) =>
  createHash('sha256').update(token).digest('hex')

// Match unknown-user password work to avoid a cheap email-enumeration signal.
let dummyHash: Promise<string> | undefined

export async function signup(
  email: string,
  password: string,
  displayName: string,
) {
  const { db } = await import('../db/pool.js')
  const passwordHash = await hashPassword(password)
  return db.transaction(async (tx) => {
    const [user] = await tx
      .insert(users)
      .values({ email, passwordHash, displayName })
      .onConflictDoNothing({ target: users.email })
      .returning(publicUser)
    if (!user) return null
    const token = randomBytes(32).toString('base64url')
    await tx.insert(sessions).values({
      userId: user.id,
      tokenHash: tokenHash(token),
      expiresAt: new Date(Date.now() + sessionLifetime * 1000),
    })
    return { user, token }
  })
}

export async function login(email: string, password: string) {
  const { db } = await import('../db/pool.js')
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1)
  const hash =
    user?.passwordHash ??
    (await (dummyHash ??= hashPassword(randomBytes(32).toString('hex'))))
  const valid = await verifyPassword(password, hash)
  if (!user || !valid) return null
  const token = randomBytes(32).toString('base64url')
  await db.insert(sessions).values({
    userId: user.id,
    tokenHash: tokenHash(token),
    expiresAt: new Date(Date.now() + sessionLifetime * 1000),
  })
  return {
    user: { id: user.id, email: user.email, displayName: user.displayName },
    token,
  }
}

export async function getCurrentUser(token: string): Promise<AuthUser | null> {
  const { db } = await import('../db/pool.js')
  const [user] = await db
    .select(publicUser)
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(
      and(
        eq(sessions.tokenHash, tokenHash(token)),
        isNull(sessions.revokedAt),
        gt(sessions.expiresAt, new Date()),
      ),
    )
    .limit(1)
  return user ?? null
}

export async function logout(token: string) {
  const { db } = await import('../db/pool.js')
  await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(
      and(eq(sessions.tokenHash, tokenHash(token)), isNull(sessions.revokedAt)),
    )
}
