import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import pg from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import * as schema from '../db/schema.js'

describe('PostgreSQL wallets', () => {
  it('enforces ownership, concurrency and database constraints', async () => {
    const { env } = await import('../lib/env.js')
    const config = {
      host: env.POSTGRES_HOST,
      port: env.POSTGRES_PORT,
      user: env.POSTGRES_USER,
      password: env.POSTGRES_PASSWORD,
      database: env.POSTGRES_DB,
      ssl: env.POSTGRES_SSL,
    }
    const admin = new pg.Pool(config)
    const name = `wallet_test_${randomUUID().replaceAll('-', '')}`
    const pool = new pg.Pool({ ...config, options: `-c search_path=${name}` })
    const originalOptions = process.env.PGOPTIONS
    let apiPool: pg.Pool | undefined
    try {
      await admin.query(`CREATE SCHEMA "${name}"`)
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
        await pool.query(sql.replaceAll('"public".', `"${name}".`))
      }
      const db = drizzle(pool, { schema })
      process.env.PGOPTIONS = `-c search_path=${name}`
      apiPool = (await import('../db/pool.js')).pool
      const { createApp } = await import('../app.js')
      const [alice, bob] = await db
        .insert(schema.users)
        .values([
          {
            email: 'alice@example.test',
            displayName: 'Alice',
            passwordHash: 'test-only',
          },
          {
            email: 'bob@example.test',
            displayName: 'Bob',
            passwordHash: 'test-only',
          },
        ])
        .returning()
      const { createHash } = await import('node:crypto')
      for (const user of [alice, bob])
        await db.insert(schema.sessions).values({
          userId: user.id,
          tokenHash: createHash('sha256').update(user.id).digest('hex'),
          expiresAt: new Date(Date.now() + 60000),
        })
      const app = createApp()
      const headers = (user = alice) => ({
        Cookie: `session=${user.id}`,
        'Content-Type': 'application/json',
      })
      const address = (digit: string) => `0x${digit.repeat(40)}`
      const post = (addr: string, user = alice) =>
        app.request('/wallet', {
          method: 'PUT',
          headers: headers(user),
          body: JSON.stringify({ address: addr, chainId: 84532 }),
        })
      const responses = await Promise.all([
        post(address('a')),
        post(address('A')),
      ])
      expect(responses.map((response) => response.status).sort()).toEqual([
        200, 201,
      ])
      const bodies = await Promise.all(
        responses.map(
          async (response) =>
            (await response.json()) as {
              wallet: { id: string; status: string; verifiedAt: null }
            },
        ),
      )
      expect(bodies[0].wallet).toEqual(bodies[1].wallet)
      expect(bodies[0].wallet.status).toBe('candidate')
      expect(bodies[0].wallet.verifiedAt).toBeNull()
      const id = bodies[0].wallet.id
      expect((await post(address('a'), bob)).status).toBe(409)
      expect(
        (await app.request('/wallet', { headers: headers(bob) })).status,
      ).toBe(404)
      const current = await app.request('/wallet', { headers: headers() })
      expect(current.status).toBe(200)
      expect(
        ((await current.json()) as { wallet: { id: string } }).wallet.id,
      ).toBe(id)
      const competing = await Promise.all([
        post(address('b')),
        post(address('b'), bob),
      ])
      expect(competing.map((response) => response.status).sort()).toEqual([
        201, 409,
      ])
      expect((await post(address('c'))).status).toBe(409)
      const [charlie, diana] = await db
        .insert(schema.users)
        .values([
          {
            email: 'charlie@example.test',
            displayName: 'Charlie',
            passwordHash: 'test-only',
          },
          {
            email: 'diana@example.test',
            displayName: 'Diana',
            passwordHash: 'test-only',
          },
        ])
        .returning()
      await db.insert(schema.sessions).values({
        userId: charlie.id,
        tokenHash: createHash('sha256').update(charlie.id).digest('hex'),
        expiresAt: new Date(Date.now() + 60000),
      })
      const sameUser = await Promise.all([
        post(address('c'), charlie),
        post(address('d'), charlie),
      ])
      expect(sameUser.map((response) => response.status).sort()).toEqual([
        201, 409,
      ])
      expect(
        await db
          .select()
          .from(schema.wallets)
          .where(eq(schema.wallets.userId, charlie.id)),
      ).toHaveLength(1)
      await expect(
        db
          .insert(schema.wallets)
          .values({ userId: alice.id, address: address('e'), chainId: 84532 }),
      ).rejects.toThrow()
      const values = { userId: diana.id, address: address('d'), chainId: 84532 }
      for (const invalid of [
        { ...values, address: address('D') },
        { ...values, chainId: 1 },
        { ...values, status: 'invalid' },
        { ...values, status: 'verified' },
        { ...values, verifiedAt: new Date() },
        { ...values, userId: randomUUID() },
        { ...values, address: address('a') },
      ])
        await expect(
          db.insert(schema.wallets).values(invalid),
        ).rejects.toThrow()
      await db
        .update(schema.wallets)
        .set({ status: 'verified', verifiedAt: new Date() })
        .where(eq(schema.wallets.id, id))
      const verified = await app.request('/wallet', {
        headers: headers(),
      })
      expect(verified.status).toBe(200)
      expect(
        ((await verified.json()) as { wallet: { id: string } }).wallet.id,
      ).toBe(id)
      const bobWallet = await app.request('/wallet', { headers: headers(bob) })
      expect(bobWallet.status).toBe(200)
      expect(
        ((await bobWallet.json()) as { wallet: { userId: string } }).wallet
          .userId,
      ).toBe(bob.id)
      const challenge = {
        walletId: id,
        challengeHash: 'a'.repeat(64),
        expiresAt: new Date(Date.now() + 300000),
      }
      await db.insert(schema.walletVerifications).values(challenge)
      await expect(
        db.insert(schema.walletVerifications).values(challenge),
      ).rejects.toThrow()
      await expect(
        db.insert(schema.walletVerifications).values({
          ...challenge,
          challengeHash: 'b'.repeat(64),
          walletId: randomUUID(),
        }),
      ).rejects.toThrow()
      await db.update(schema.sessions).set({ expiresAt: new Date(0) })
      expect(
        (await app.request('/wallet', { headers: headers() })).status,
      ).toBe(401)
    } finally {
      if (originalOptions === undefined) delete process.env.PGOPTIONS
      else process.env.PGOPTIONS = originalOptions
      await apiPool?.end()
      await pool.end()
      try {
        await admin.query(`DROP SCHEMA IF EXISTS "${name}" CASCADE`)
      } finally {
        await admin.end()
      }
    }
  }, 30000)
})
