import { z } from '@hono/zod-openapi'

export const LoginSchema = z
  .object({
    email: z.string().trim().toLowerCase().pipe(z.email().max(255)),
    password: z.string().min(1).max(1024),
  })
  .openapi('Login')
export const SignupSchema = LoginSchema.extend({
  password: z.string().min(8).max(1024),
  displayName: z.string().trim().min(1).max(150),
}).openapi('Signup')
export const AuthResponseSchema = z
  .object({
    user: z.object({
      id: z.uuid(),
      email: z.email(),
      displayName: z.string(),
    }),
  })
  .openapi('AuthResponse')
export const AuthErrorSchema = z
  .object({ error: z.string() })
  .openapi('AuthError')
