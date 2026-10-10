import { describe, expect, it } from 'vitest'
import { createApp } from '../app.js'

describe('GET /health', () => {
  it('returns the health response without a database', async () => {
    const response = await createApp().request('/health')
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ status: 'ok' })
  })
})
