import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { recover } from '../src/oidc'
import { configureCoopId } from '../src/oidc/client'

beforeEach(() => configureCoopId({ apiUrl: 'https://coop.example' }))
afterEach(() => vi.unstubAllGlobals())

describe('recover (Эпик 3) — запрос восстановления доступа', () => {
  it('шлёт POST /coop/recovery/request с email (202 — нормальный путь, анти-enumeration)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 202, json: async () => ({}) })
    vi.stubGlobal('fetch', fetchMock)

    await recover('user@example.com')

    expect(fetchMock.mock.calls[0][0]).toBe('https://coop.example/coop/recovery/request')
    expect(fetchMock.mock.calls[0][1].method).toBe('POST')
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ email: 'user@example.com' })
  })

  it('429 → TooManyRecoveryAttempts', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 429, json: async () => ({}) }))
    await expect(recover('u@e.com')).rejects.toMatchObject({ code: 'too_many_recovery_attempts' })
  })

  it('сеть упала → NetworkError', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('down')))
    await expect(recover('u@e.com')).rejects.toMatchObject({ code: 'network_error' })
  })
})
