/**
 * Embedded trust anchor цепочки доверия: публичный ключ `ano.cert` в
 * Antelope-формате (`PUB_K1_…`, кривая secp256k1). Якорь вшивается в пакет
 * (release-pinned), чтобы `verifyOffline()` укоренял `coop_chain` без сети.
 *
 * Формат — Antelope-строка, а не JWK: вся цепь (`coop_chain`, `readCertPublicKey`,
 * wharfkit-верификация) оперирует `PUB_K1_…`; JWK был несравним со звеньями
 * (реконсиляция скелета 1.2 ↔ реальности, Story 4.4).
 *
 * TODO(release): подставить реальный ключ после создания permission `cert` на
 * аккаунте `ano` в COOPOS (hash-pinned bundle в consuming-приложениях, NFR).
 */
export const TRUST_ANCHOR_ANO_CERT_PUBKEY: string | null = null
