import dotenv from 'dotenv'
import { z } from 'zod'

dotenv.config({ quiet: true })

const schema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:5173')
    .transform((value) =>
      value.split(',').map((origin) => z.url().parse(origin.trim())),
    ),
  POSTGRES_HOST: z.string().min(1),
  POSTGRES_PORT: z.coerce.number().int().min(1).max(65535),
  POSTGRES_USER: z.string().min(1),
  POSTGRES_PASSWORD: z.string().min(1),
  POSTGRES_DB: z.string().min(1),
  POSTGRES_SSL: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true'),
})

export const env = schema.parse(process.env)
