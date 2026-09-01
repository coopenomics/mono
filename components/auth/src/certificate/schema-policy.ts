/**
 * Политика версий схемы claims удостоверения на стороне SDK (Story 4.10).
 * Зеркало публичной `/.well-known/coopid-schema-policy.json` контроллера: типы,
 * сравнение версий и кэш с TTL 24ч. `verifyOffline` сверяет `claim_schema_version`
 * проверяемого сертификата с минимально поддерживаемой версией из этого кэша.
 *
 * Кросс-рантайм: SDK владеет ЛОГИКОЙ кеша/сравнения; сам HTTP-fetch политики
 * инжектируется хостом (как и весь fetch в SDK — chain/ остаётся чисто офлайновым).
 */

/** Путь публичной политики версий схемы у контроллера кооператива. */
export const SCHEMA_POLICY_WELL_KNOWN_PATH = '/.well-known/coopid-schema-policy.json'

/** TTL кэша политики: офлайн принимает закэшированную min-версию до 24 часов (FR72). */
export const SCHEMA_POLICY_CACHE_TTL_MS = 24 * 60 * 60 * 1000

export interface CoopIdSchemaPolicy {
  current_version: string
  min_supported_version: string
  deprecation: Record<string, string>
}

/**
 * Сравнить две версии схемы. Версии — целочисленные строки (`'0'`, `'1'`, …):
 * сравниваем численно, при нечисловой версии — лексикографический фолбэк.
 * `< 0` если a старее b, `0` если равны, `> 0` если a новее.
 */
export function compareSchemaVersions(a: string, b: string): number {
  const na = Number(a)
  const nb = Number(b)
  if (Number.isFinite(na) && Number.isFinite(nb))
    return na - nb
  if (a === b)
    return 0
  return a < b ? -1 : 1
}

/** Поддерживается ли версия схемы (не старее минимально поддерживаемой). */
export function isSchemaVersionSupported(version: string, minSupported: string): boolean {
  return compareSchemaVersions(version, minSupported) >= 0
}

export interface SchemaPolicyCacheOptions {
  /** Хост-колбэк, тянущий политику с `SCHEMA_POLICY_WELL_KNOWN_PATH` (fetch — у приложения). */
  fetchPolicy: () => Promise<CoopIdSchemaPolicy>
  /** «Сейчас» в мс (инъекция для детерминизма/тестов). */
  now?: () => number
  /** TTL кэша в мс (по умолчанию 24ч). */
  ttlMs?: number
}

export interface SchemaPolicyCache {
  /** Политика из кэша (свежий fetch при истёкшем TTL; stale-кэш при офлайне). */
  getPolicy: () => Promise<CoopIdSchemaPolicy>
  /** Минимально поддерживаемая версия — для передачи в `verifyOffline`. */
  getMinSupportedVersion: () => Promise<string>
}

/**
 * Кэш политики версий схемы с TTL 24ч (Story 4.10, FR72). В пределах TTL отдаёт
 * закэшированную политику без сети. По истечении TTL пробует обновить; если fetch
 * упал (офлайн/недоступность) — отдаёт последнюю валидную политику (недоступность
 * сети НЕ роняет офлайн-проверку; короткий cert TTL ограничивает риск устаревания).
 * Нет кэша и fetch упал → пробрасывает ошибку (политику взять неоткуда).
 */
export function createSchemaPolicyCache(options: SchemaPolicyCacheOptions): SchemaPolicyCache {
  const now = options.now ?? (() => Date.now())
  const ttlMs = options.ttlMs ?? SCHEMA_POLICY_CACHE_TTL_MS
  let cached: { policy: CoopIdSchemaPolicy, fetchedAt: number } | null = null

  const getPolicy = async (): Promise<CoopIdSchemaPolicy> => {
    if (cached && now() - cached.fetchedAt < ttlMs)
      return cached.policy
    try {
      const policy = await options.fetchPolicy()
      cached = { policy, fetchedAt: now() }
      return policy
    }
    catch (error) {
      if (cached)
        return cached.policy
      throw error
    }
  }

  return {
    getPolicy,
    getMinSupportedVersion: async () => (await getPolicy()).min_supported_version,
  }
}
