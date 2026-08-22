/**
 * participant_certificate: чтение claims на клиенте (ЛК, Story 1.9) и offline-
 * верификация (Story 4.4). Здесь — только ДЕКОДИРОВАНИЕ payload и производные
 * (статус, человекочитаемые типы верификации). Проверка подписи против trust
 * anchor — отдельно (verifyOffline, chain/), для отображения в ЛК не требуется.
 */
import { decodeJwt } from 'jose'
import { AuthV2Error, AuthV2ErrorCode } from '../errors'

export * from './schema-policy'

/**
 * Разобранное звено цепочки признания — для показа человеку. Подпись при этом не
 * проверяется: проверка живёт в `verifyOffline`, и дублировать её ради подписи
 * под именем на экране незачем.
 */
export interface TrustChainLink {
  /** Кто заверил. */
  issuer: string
  /** Кого заверили. */
  subject: string
  /** Признанный ключ заверения субъекта. */
  cert: string
  /** До какого момента действует признание, unix-секунды. */
  expiresAt: number
}

/**
 * Подтверждённый тип верификации в удостоверении (Story 4.3). Структурная форма
 * для RP: что подтверждено (`type`), когда (`verified_at`, ISO-8601 UTC) и на каком
 * основании (`source`).
 */
export interface VerificationTypeClaim {
  type: string
  verified_at: string
  source: string
  /** Кто провёл верификацию (аккаунт) — у персональных подтверждений. */
  attested_by?: string
  /** Кооперативный участок, где сверена личность; пусто — сверял совет кооператива. */
  attested_in?: string
}

/** Claims participant_certificate (зеркало payload контроллера, Story 1.8). */
export interface ParticipantCertificateClaims {
  iss: string
  /** UUID пайщика */
  sub: string
  /** серийный номер удостоверения */
  jti: string
  iat: number
  exp: number
  coopname: string
  /**
   * Цепочка заверений от корня к выпустившему кооперативу — подписанные заверения
   * целиком, по порядку. Именно она позволяет проверить удостоверение без сети:
   * перечень имён и ключей ничего не доказывал бы, подпись доказывает.
   */
  trust_chain: string[]
  verification_types: VerificationTypeClaim[]
  identification: Record<string, unknown> | null
  claim_schema_version: string
  /** 152-ФЗ-обязательство RP удалить данные пайщика (Story 4.8), напр. `erase_on_exclusion`. */
  data_retention_contract: string
  /** Дедлайн удаления данных RP, unix-секунды (`iat + 30 дней`, Story 4.8). */
  retention_deadline_ts: number
}

/** Нормализовать сырой claim verification_types в структурную форму (Story 4.3). */
function normalizeVerificationTypes(raw: unknown): VerificationTypeClaim[] {
  if (!Array.isArray(raw))
    return []
  return raw
    .filter((e): e is Record<string, unknown> => typeof e === 'object' && e !== null && typeof (e as Record<string, unknown>).type === 'string')
    .map(e => ({
      type: String(e.type),
      verified_at: String(e.verified_at ?? ''),
      source: String(e.source ?? ''),
      ...(typeof e.attested_by === 'string' && e.attested_by ? { attested_by: e.attested_by } : {}),
      ...(typeof e.attested_in === 'string' && e.attested_in ? { attested_in: e.attested_in } : {}),
    }))
}

export type CertificateStatus = 'active' | 'expiring' | 'expired'

/** Окно «истекает» до exp (24ч по умолчанию у сертификата; здесь — последний час). */
export const CERTIFICATE_EXPIRING_WINDOW_MS = 60 * 60 * 1000

/**
 * Человекочитаемые названия уровней верификации (claim `verification_types`).
 * Лестница уровней: начальный (вступительный и паевой взносы уплачены) →
 * базовый (паспорт сверен при личной явке) → усиленный (внешний KYC, будущее).
 */
export const VERIFICATION_TYPE_LABELS: Record<string, string> = {
  coop_baseline: 'Начальный: подтверждён платежом',
  passport_onsite: 'Базовый: личность сверена с паспортом',
}

/**
 * Лестница уровней снизу вверх. Уровни — независимые факты-подтверждения, но
 * пайщику и совету показывается ровно один: тот, до которого он поднялся.
 * Отсюда порядок — он же определяет, какой уровень считается текущим, и что
 * останется, если верхний отзовут. Новый уровень добавляется сюда же.
 */
export const VERIFICATION_LEVEL_ORDER: readonly string[] = ['coop_baseline', 'passport_onsite']

/** Место уровня в лестнице; неизвестный — ниже всех (клиент отстал от сервера). */
export function verificationLevelRank(type: string): number {
  return VERIFICATION_LEVEL_ORDER.indexOf(type)
}

/**
 * Текущий уровень пайщика — самый высокий из достигнутых. Пусто, если нет ни
 * одного. Незнакомый тип не вытесняет знакомый, но и не теряется: когда он
 * единственный, вернётся он.
 */
export function highestVerificationType(types: readonly string[]): string | undefined {
  if (!types.length) return undefined
  return types.reduce((best, type) =>
    verificationLevelRank(type) > verificationLevelRank(best) ? type : best,
  )
}

/** Описание типа верификации; неизвестный — отдаём как есть (forward-compat). */
export function verificationTypeLabel(type: string): string {
  return VERIFICATION_TYPE_LABELS[type] ?? type
}

/** Короткие названия уровней — для чипов в таблицах и карточках. */
export const VERIFICATION_TYPE_SHORT_LABELS: Record<string, string> = {
  coop_baseline: 'Начальный',
  passport_onsite: 'Базовый',
}

/** Короткое название уровня; неизвестный — отдаём как есть (forward-compat). */
export function verificationTypeShortLabel(type: string): string {
  return VERIFICATION_TYPE_SHORT_LABELS[type] ?? type
}

/**
 * Он-чейн запись верификации аккаунта (`registrator::accounts.verifications`),
 * как она приходит с цепи через GraphQL поле `user_account.verifications`.
 */
export interface ChainVerificationRecord {
  verificator: string
  is_verified: boolean
  procedure: string
  created_at: string
  last_update?: string
  notice?: string
}

/** Он-чейн процедуры, дающие уровень верификации (расширяемый реестр). */
export const CHAIN_PROCEDURE_TO_TYPE: Record<string, string> = {
  passport: 'passport_onsite',
}

/**
 * Контекст проведения верификации контракт пишет в `notice` как `coopname/braname`:
 * участок — когда braname указан, совет кооператива — когда пусто.
 */
export function branchFromNotice(notice?: string): string {
  const separator = (notice ?? '').indexOf('/')
  return separator === -1 ? '' : (notice ?? '').slice(separator + 1)
}

/**
 * Вывести уровни верификации пайщика из данных аккаунта (единый маппинг для
 * реестра пайщиков, ЛК и считывателя — чтобы клиенты не дублировали логику ядра):
 * `coop_baseline` — из принятого членства (`participant_account.status === 'accepted'`),
 * документные уровни — из он-чейн записей (`user_account.verifications`).
 */
export function deriveVerificationTypes(input: {
  participant_account?: { status?: string | null, created_at?: string | null } | null
  user_account?: { verifications?: ChainVerificationRecord[] | null } | null
}): VerificationTypeClaim[] {
  const entries: VerificationTypeClaim[] = []

  if (input.participant_account?.status === 'accepted') {
    entries.push({
      type: 'coop_baseline',
      verified_at: input.participant_account.created_at ?? '',
      source: 'cooperative_decision',
    })
  }

  for (const record of input.user_account?.verifications ?? []) {
    if (!record?.is_verified)
      continue
    const type = CHAIN_PROCEDURE_TO_TYPE[record.procedure]
    if (!type || entries.some(e => e.type === type))
      continue
    const branch = branchFromNotice(record.notice)
    entries.push({
      type,
      verified_at: record.created_at ?? '',
      source: branch ? 'branch_attestation' : 'council_attestation',
      attested_by: record.verificator,
      ...(branch ? { attested_in: branch } : {}),
    })
  }

  return entries
}

/**
 * Декодировать compact JWS в claims БЕЗ проверки подписи (для отображения в ЛК).
 * Бросает AuthV2Error при структурно некорректном сертификате.
 */
export function decodeParticipantCertificate(jws: string): ParticipantCertificateClaims {
  let raw: Record<string, unknown>
  try {
    raw = decodeJwt(jws) as Record<string, unknown>
  }
  catch {
    throw new AuthV2Error(AuthV2ErrorCode.ChainVerificationFailed, 'Некорректный participant_certificate: не удалось прочитать claims')
  }
  if (typeof raw.jti !== 'string' || typeof raw.exp !== 'number' || typeof raw.sub !== 'string')
    throw new AuthV2Error(AuthV2ErrorCode.ChainVerificationFailed, 'participant_certificate без обязательных claims (jti/exp/sub)')

  return {
    iss: String(raw.iss ?? ''),
    sub: raw.sub,
    jti: raw.jti,
    iat: Number(raw.iat ?? 0),
    exp: raw.exp,
    coopname: String(raw.coopname ?? ''),
    trust_chain: Array.isArray(raw.trust_chain) ? (raw.trust_chain as string[]).filter(l => typeof l === 'string') : [],
    verification_types: normalizeVerificationTypes(raw.verification_types),
    identification: (raw.identification as Record<string, unknown> | null) ?? null,
    claim_schema_version: String(raw.claim_schema_version ?? ''),
    data_retention_contract: String(raw.data_retention_contract ?? ''),
    retention_deadline_ts: Number(raw.retention_deadline_ts ?? 0),
  }
}

/** Статус по сроку действия: expired / expiring (близко к exp) / active. */
export function certificateStatus(claims: Pick<ParticipantCertificateClaims, 'exp'>, nowMs: number = Date.now()): CertificateStatus {
  const expMs = claims.exp * 1000
  if (nowMs >= expMs)
    return 'expired'
  if (expMs - nowMs <= CERTIFICATE_EXPIRING_WINDOW_MS)
    return 'expiring'
  return 'active'
}

/**
 * Окно упреждающего перезапроса сертификата (Story 4.6): за 5 минут до `exp` SDK
 * молча обновляет удостоверение, чтобы у короткоживущего cert (дефолт 1ч) не было
 * разрыва доступа на стыке.
 */
export const CERTIFICATE_RENEWAL_LEAD_MS = 5 * 60 * 1000

/**
 * Сколько миллисекунд ждать до момента перезапроса (`exp − lead`). Никогда не
 * отрицательно: если до `exp` осталось ≤ lead (или cert уже истёк) — 0 (перезапрос сразу).
 */
export function computeRenewalDelayMs(claims: Pick<ParticipantCertificateClaims, 'exp'>, nowMs: number = Date.now()): number {
  const renewAtMs = claims.exp * 1000 - CERTIFICATE_RENEWAL_LEAD_MS
  return Math.max(0, renewAtMs - nowMs)
}

/** Управление запланированным авто-обновлением сертификата. */
export interface CertificateRenewalHandle {
  /** Отменить запланированный перезапрос (например, при logout). */
  cancel: () => void
}

/** Параметры планировщика — для подмены времени/таймеров в тестах. */
export interface ScheduleCertificateRenewalOptions {
  now?: () => number
  setTimer?: (callback: () => void, delayMs: number) => ReturnType<typeof setTimeout>
  clearTimer?: (handle: ReturnType<typeof setTimeout>) => void
}

/**
 * Запланировать silent renewal сертификата за 5 минут до `exp` (Story 4.6). По
 * срабатыванию таймера вызывает `renew()` — хост-колбэк, который обновляет access
 * через `refresh_token` и тянет свежий cert (`getParticipantCertificate`), — затем
 * перепланирует от `exp` нового удостоверения. Кросс-рантайм: SDK владеет ЛОГИКОЙ
 * планирования, а транспорт/refresh — на стороне приложения (как и весь fetch в SDK).
 * Бесконечный цикл сам себя продлевает, пока не вызван `cancel()`. Ошибка `renew`
 * не роняет процесс (логируется), но и НЕ перепланирует — повторную попытку инициирует хост.
 */
export function scheduleCertificateRenewal(
  initialJws: string,
  renew: () => Promise<string>,
  options: ScheduleCertificateRenewalOptions = {},
): CertificateRenewalHandle {
  const now = options.now ?? (() => Date.now())
  const setTimer = options.setTimer ?? ((cb, ms) => setTimeout(cb, ms))
  const clearTimer = options.clearTimer ?? (h => clearTimeout(h))

  let timer: ReturnType<typeof setTimeout> | null = null
  let cancelled = false

  const scheduleFrom = (jws: string): void => {
    if (cancelled)
      return
    const claims = decodeParticipantCertificate(jws)
    const delay = computeRenewalDelayMs(claims, now())
    timer = setTimer(() => {
      void renew()
        .then((nextJws) => {
          if (!cancelled)
            scheduleFrom(nextJws)
        })
        .catch(() => {
          // best-effort: сбой обновления (нет сети/refresh истёк) не роняет цикл;
          // повторную попытку инициирует приложение (например, при следующем действии).
        })
    }, delay)
  }

  scheduleFrom(initialJws)

  return {
    cancel: () => {
      cancelled = true
      if (timer !== null)
        clearTimer(timer)
    },
  }
}

/**
 * Разобрать цепочку заверений для показа: кто кого признал и до какого срока.
 *
 * Подпись здесь не проверяется намеренно. Вопрос «подлинно ли» решает
 * `verifyOffline` единственной реализацией; здесь отвечают на другой вопрос —
 * «что показать человеку». Две реализации проверки однажды разошлись бы, и
 * экран начал бы уверять в том, чего проверяющий не подтверждает.
 *
 * Нечитаемые звенья пропускаются: показать неполную цепочку лучше, чем не
 * показать ничего.
 */
export function decodeTrustChain(chain: string[]): TrustChainLink[] {
  const links: TrustChainLink[] = []
  for (const raw of chain) {
    try {
      const claims = decodeJwt(raw) as Record<string, unknown>
      if (typeof claims.iss !== 'string' || typeof claims.sub !== 'string')
        continue
      links.push({
        issuer: claims.iss,
        subject: claims.sub,
        cert: typeof claims.cert === 'string' ? claims.cert : '',
        expiresAt: typeof claims.exp === 'number' ? claims.exp : 0,
      })
    }
    catch {
      continue
    }
  }
  return links
}
