import { describe, expect, it, vi } from 'vitest'
import {
  compareSchemaVersions,
  type CoopIdSchemaPolicy,
  createSchemaPolicyCache,
  isSchemaVersionSupported,
  SCHEMA_POLICY_CACHE_TTL_MS,
} from '../src/index'

const POLICY: CoopIdSchemaPolicy = { current_version: '1', min_supported_version: '1', deprecation: { 0: '2026-01-01' } }

describe('compareSchemaVersions (Story 4.10)', () => {
  it('числовое сравнение версий', () => {
    expect(compareSchemaVersions('0', '1')).toBeLessThan(0)
    expect(compareSchemaVersions('2', '1')).toBeGreaterThan(0)
    expect(compareSchemaVersions('1', '1')).toBe(0)
  })

  it('нечисловая версия → лексикографический фолбэк', () => {
    expect(compareSchemaVersions('a', 'b')).toBeLessThan(0)
    expect(compareSchemaVersions('v2', 'v2')).toBe(0)
  })

  it('isSchemaVersionSupported: не старее минимума', () => {
    expect(isSchemaVersionSupported('1', '1')).toBe(true)
    expect(isSchemaVersionSupported('2', '1')).toBe(true)
    expect(isSchemaVersionSupported('0', '1')).toBe(false)
  })
})

describe('createSchemaPolicyCache (Story 4.10, FR72)', () => {
  it('в пределах TTL отдаёт кэш без повторного fetch', async () => {
    let t = 1000
    const fetchPolicy = vi.fn().mockResolvedValue(POLICY)
    const cache = createSchemaPolicyCache({ fetchPolicy, now: () => t })
    expect(await cache.getMinSupportedVersion()).toBe('1')
    t += SCHEMA_POLICY_CACHE_TTL_MS - 1
    await cache.getPolicy()
    expect(fetchPolicy).toHaveBeenCalledTimes(1)
  })

  it('после истечения TTL рефетчит политику', async () => {
    let t = 1000
    const fetchPolicy = vi.fn().mockResolvedValue(POLICY)
    const cache = createSchemaPolicyCache({ fetchPolicy, now: () => t })
    await cache.getPolicy()
    t += SCHEMA_POLICY_CACHE_TTL_MS + 1
    await cache.getPolicy()
    expect(fetchPolicy).toHaveBeenCalledTimes(2)
  })

  it('офлайн (fetch упал) после истечения TTL → отдаёт stale-кэш', async () => {
    let t = 1000
    const fetchPolicy = vi.fn()
      .mockResolvedValueOnce(POLICY)
      .mockRejectedValueOnce(new Error('offline'))
    const cache = createSchemaPolicyCache({ fetchPolicy, now: () => t })
    await cache.getPolicy()
    t += SCHEMA_POLICY_CACHE_TTL_MS + 1
    expect(await cache.getMinSupportedVersion()).toBe('1')
  })

  it('нет кэша и fetch упал → пробрасывает ошибку', async () => {
    const fetchPolicy = vi.fn().mockRejectedValue(new Error('offline'))
    const cache = createSchemaPolicyCache({ fetchPolicy })
    await expect(cache.getPolicy()).rejects.toThrow('offline')
  })
})
