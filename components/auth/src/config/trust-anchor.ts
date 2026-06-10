/**
 * Embedded trust anchor цепочки доверия: публичный ключ `ano.cert` (ES256K).
 * Якорь вшивается в пакет, чтобы verifyOffline() работал без сети.
 *
 * TODO(Story 1.3): подставить реальный JWK после создания permission `cert`
 * на аккаунте `ano` в COOPOS.
 */
export const TRUST_ANCHOR_ANO_CERT_JWK: JsonWebKey | null = null
