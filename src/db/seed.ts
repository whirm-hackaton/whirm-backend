import { pathToFileURL } from 'node:url'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { users } from './schema.js'
import { hashPassword } from '../lib/password.js'

export async function seedUsers(
  db: NodePgDatabase<typeof import('./schema.js')>,
) {
  const accounts = [
    { email: 'alice@example.test', displayName: 'Alice' },
    { email: 'bob@example.test', displayName: 'Bob' },
  ]
  const values = await Promise.all(
    accounts.map(async (user) => ({
      ...user,
      passwordHash: await hashPassword('Hackaton2026!'),
    })),
  )
  await db.transaction(async (tx) => {
    await tx
      .insert(users)
      .values(values)
      .onConflictDoNothing({ target: users.email })
  })
}

async function main() {
  const { env } = await import('../lib/env.js')
  if (env.NODE_ENV === 'production')
    throw new Error('Demo seeding is disabled in production')
  const { db, pool } = await import('./pool.js')
  try {
    await seedUsers(db)
    console.log('Demo users ready: alice@example.test, bob@example.test')
  } finally {
    await pool.end()
  }
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error: unknown) => {
    console.error(error)
    process.exitCode = 1
  })
}
