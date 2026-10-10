import { sql } from 'drizzle-orm'
import {
  check,
  integer,
  uniqueIndex,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
  id: uuid().primaryKey().defaultRandom(),
  email: varchar({ length: 255 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  displayName: varchar('display_name', { length: 150 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

export const sessions = pgTable(
  'sessions',
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    tokenHash: text('token_hash').notNull().unique(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (table) => [index('sessions_user_id_idx').on(table.userId)],
)

export const wallets = pgTable(
  'wallets',
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    address: varchar({ length: 42 }).notNull(),
    chainId: integer('chain_id').notNull(),
    status: text().notNull().default('candidate'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('wallets_address_chain_idx').on(table.address, table.chainId),
    index('wallets_user_id_idx').on(table.userId),
    uniqueIndex('wallets_verified_user_idx')
      .on(table.userId)
      .where(sql`${table.status} = 'verified'`),
    check('wallets_address_check', sql`${table.address} ~ '^0x[0-9a-f]{40}$'`),
    check('wallets_chain_check', sql`${table.chainId} = 84532`),
    check(
      'wallets_status_check',
      sql`${table.status} IN ('candidate', 'unverified', 'verified')`,
    ),
    check(
      'wallets_verified_at_check',
      sql`(${table.status} = 'verified') = (${table.verifiedAt} IS NOT NULL)`,
    ),
  ],
)

export const walletVerifications = pgTable(
  'wallet_verifications',
  {
    id: uuid().primaryKey().defaultRandom(),
    walletId: uuid('wallet_id')
      .notNull()
      .references(() => wallets.id),
    challengeHash: text('challenge_hash').notNull().unique(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
  },
  (table) => [index('wallet_verifications_wallet_id_idx').on(table.walletId)],
)
