import { describe, expect, it } from 'vitest'
import { hashPassword, verifyPassword } from './password.js'

describe('password hashing', () => {
  it('salts each hash and verifies only the correct password', async () => {
    const first = await hashPassword('Hackaton2026!')
    const second = await hashPassword('Hackaton2026!')
    expect(first).not.toBe(second)
    expect(await verifyPassword('Hackaton2026!', first)).toBe(true)
    expect(await verifyPassword('wrong', first)).toBe(false)
    expect(await verifyPassword('Hackaton2026!', 'scrypt$broken')).toBe(false)
  })
})
