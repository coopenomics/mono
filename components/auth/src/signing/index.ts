/**
 * Подпись: документы (канонизация + ES256K) и timestamp-подпись второго
 * этапа аутентификации. Реализация — Stories 2.3–2.4.
 */
import { notImplemented } from '../errors'

export interface SignedDocument {
  hash: string
  signature: string
  public_key: string
}

export interface TimestampSignature {
  ts: string
  binding_token_jti: string
  sub: string
  signature: string
  public_key: string
}

/** Подпись документа приватным ключом пайщика (client-side). Story 2.3. */
export async function signDocument(_document: unknown): Promise<SignedDocument> {
  notImplemented('signDocument')
}

/** Подпись timestamp для POST /coop/verify/timestamp (окно 60 сек). Story 2.4. */
export async function signTimestamp(): Promise<TimestampSignature> {
  notImplemented('signTimestamp')
}
