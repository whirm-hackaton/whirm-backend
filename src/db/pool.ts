import pg from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { env } from '../lib/env.js'
import * as schema from './schema.js'

export const pool = new pg.Pool({
  host: env.POSTGRES_HOST,
  port: env.POSTGRES_PORT,
  user: env.POSTGRES_USER,
  password: env.POSTGRES_PASSWORD,
  database: env.POSTGRES_DB,
  ssl: env.POSTGRES_SSL,
})
export const db = drizzle(pool, { schema })
