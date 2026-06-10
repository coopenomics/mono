/**
 * Цепочка доверия: офлайн-проверка participant_certificate walk'ом
 * `ano → voskhod → vostok → participant` от embedded trust anchor.
 * Реализация — Story 4.4.
 */
import { notImplemented } from '../errors'

export interface VerifyOfflineResult {
  valid: boolean
  /** Причина отказа, если valid=false (expired / revoked / chain broken) */
  reason?: string
}

/** Офлайн-валидация удостоверения без обращения к сети. Story 4.4. */
export async function verifyOffline(_certificate: string): Promise<VerifyOfflineResult> {
  notImplemented('verifyOffline')
}
