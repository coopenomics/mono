/**
 * participant_certificate: чтение claims на клиенте (ЛК, Story 1.9) и offline-
 * верификация (Story 4.4). Здесь — только ДЕКОДИРОВАНИЕ payload и производные
 * (статус, человекочитаемые типы верификации). Проверка подписи против trust
 * anchor — отдельно (verifyOffline, chain/), для отображения в ЛК не требуется.
 */
import { decodeJwt } from 'jose'
import { AuthV2Error, AuthV2ErrorCode } from '../errors'

export interface CoopChainLink {
  account: string
  public_key: string
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
  coop_chain: CoopChainLink[]
  verification_types: VerificationTypeClaim[]
  identification: Record<string, unknown> | null
  claim_schema_version: string
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
    }))
}

export type CertificateStatus = 'active' | 'expiring' | 'expired'

/** Окно «истекает» до exp (24ч по умолчанию у сертификата; здесь — последний час). */
export const CERTIFICATE_EXPIRING_WINDOW_MS = 60 * 60 * 1000

/** Человекочитаемые описания типов верификации (claim `verification_types`). */
export const VERIFICATION_TYPE_LABELS: Record<string, string> = {
  coop_baseline: 'Базовое подтверждение кооперативом',
}

/** Описание типа верификации; неизвестный — отдаём как есть (forward-compat). */
export function verificationTypeLabel(type: string): string {
  return VERIFICATION_TYPE_LABELS[type] ?? type
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
    coop_chain: Array.isArray(raw.coop_chain) ? (raw.coop_chain as CoopChainLink[]) : [],
    verification_types: normalizeVerificationTypes(raw.verification_types),
    identification: (raw.identification as Record<string, unknown> | null) ?? null,
    claim_schema_version: String(raw.claim_schema_version ?? ''),
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
