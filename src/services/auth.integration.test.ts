import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import pg from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { eq } from 'drizzle-orm'
import { describe, expect, it, vi } from 'vitest'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { createApp } from '../app.js'
import * as schema from '../db/schema.js'
import { seedUsers } from '../db/seed.js'

const testDatabase = vi.hoisted(() => ({
  db: undefined as NodePgDatabase<typeof schema> | undefined,
}))
vi.mock('../db/pool.js', () => ({
  get db() {
    if (!testDatabase.db) throw new Error('Test database is not initialized')
    return testDatabase.db
  },
}))

// Each run creates and removes an isolated schema.
describe('PostgreSQL authentication', () => {
  it('migrates, seeds idempotently and expires/revokes sessions', async () => {
    const { env } = await import('../lib/env.js')
    const pool = new pg.Pool({
      host: env.POSTGRES_HOST,
      port: env.POSTGRES_PORT,
      user: env.POSTGRES_USER,
      password: env.POSTGRES_PASSWORD,
      database: env.POSTGRES_DB,
      ssl: env.POSTGRES_SSL,
    })
    const name = `auth_test_${randomUUID().replaceAll('-', '')}`
    let client: pg.PoolClient | undefined
    try {
      client = await pool.connect()
      await client.query(`CREATE SCHEMA "${name}"`)
      await client.query(`SET search_path TO "${name}"`)
      const journal = JSON.parse(
        await readFile(
          new URL('../../drizzle/meta/_journal.json', import.meta.url),
          'utf8',
        ),
      ) as { entries: { tag: string }[] }
      for (const { tag } of journal.entries) {
        const sql = await readFile(
          new URL(`../../drizzle/${tag}.sql`, import.meta.url),
          'utf8',
        )
        await client.query(sql.replaceAll('"public".', `"${name}".`))
      }
      const db = drizzle(client, { schema })
      await seedUsers(db)
      const original = await db
        .select()
        .from(schema.users)
        .orderBy(schema.users.email)
      await seedUsers(db)
      expect(
        await db.select().from(schema.users).orderBy(schema.users.email),
      ).toEqual(original)
      expect(original).toHaveLength(2)
      testDatabase.db = db
      const app = createApp()
      const login = async (email: string, password: string) =>
        app.request('/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        })
      expect((await login('alice@example.test', 'wrong')).status).toBe(401)
      expect((await login('missing@example.test', 'wrong')).status).toBe(401)
      const response = await login('alice@example.test', 'Hackaton2026!')
      expect(response.status).toBe(200)
      const cookie = response.headers.get('set-cookie')!.split(';')[0]
      const headers = { Cookie: cookie }
      expect((await app.request('/auth/me', { headers })).status).toBe(200)
      const [session] = await db.select().from(schema.sessions)
      expect(session.tokenHash).toMatch(/^[a-f0-9]{64}$/)
      expect(session.tokenHash).not.toBe(cookie.slice('session='.length))
      expect(
        (await app.request('/auth/logout', { method: 'POST', headers })).status,
      ).toBe(204)
      expect((await app.request('/auth/me', { headers })).status).toBe(401)
      const [revoked] = await db
        .select()
        .from(schema.sessions)
        .where(eq(schema.sessions.id, session.id))
      expect(revoked.revokedAt).toBeInstanceOf(Date)
      const second = await login('bob@example.test', 'Hackaton2026!')
      const secondCookie = second.headers.get('set-cookie')!.split(';')[0]
      await db.update(schema.sessions).set({ expiresAt: new Date(0) })
      expect(
        (await app.request('/auth/me', { headers: { Cookie: secondCookie } }))
          .status,
      ).toBe(401)
    } finally {
      testDatabase.db = undefined
      try {
        if (client) {
          await client.query('SET search_path TO public')
          await client.query(`DROP SCHEMA IF EXISTS "${name}" CASCADE`)
        }
      } finally {
        client?.release()
        await pool.end()
      }
    }
  }, 30000)
})
