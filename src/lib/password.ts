import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'

const cost = 131072
const blockSize = 8
const parallelization = 1

function derive(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password,
      salt,
      64,
      { N: cost, r: blockSize, p: parallelization, maxmem: 256 * 1024 * 1024 },
      (error, key) => {
        if (error) reject(error)
        else resolve(key)
      },
    )
  })
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16)
  const key = await derive(password, salt)
  return `scrypt$${cost}$${blockSize}$${parallelization}$${salt.toString('hex')}$${key.toString('hex')}`
}

export async function verifyPassword(password: string, hash: string) {
  const parts = hash.split('$')
  if (
    parts.length !== 6 ||
    parts[0] !== 'scrypt' ||
    parts[1] !== String(cost) ||
    parts[2] !== String(blockSize) ||
    parts[3] !== String(parallelization) ||
    !/^[a-f0-9]{32}$/.test(parts[4]) ||
    !/^[a-f0-9]{128}$/.test(parts[5])
  )
    return false
  const key = await derive(password, Buffer.from(parts[4], 'hex'))
  return timingSafeEqual(key, Buffer.from(parts[5], 'hex'))
}
