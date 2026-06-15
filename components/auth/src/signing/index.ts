/**
 * Подпись: документы (Story 2.3) и timestamp-метка второго этапа аутентификации
 * (Story 2.4). Полностью локальные операции (без сети); подпись timestamp НЕ
 * создаёт audit_events.
 */
import { base64url, decodeJwt } from 'jose'
import { AuthV2Error, AuthV2ErrorCode } from '../errors'
import { currentView, readUnlockedKey } from '../wallet/storage'

export interface SignDocumentParams {
  /** Содержимое документа: байты или строка (кодируется UTF-8). */
  payload: Uint8Array | string
  /** Алгоритм подписи; поддерживается ES256K (COOPOS-кривая secp256k1). */
  alg?: 'ES256K'
}

/**
 * Подпись дайджеста транзакции COOPOS ключом пайщика из keystore (мост подписи
 * CoopID, Эпик 7). Приватный ключ НЕ покидает keystore — наружу уходит только
 * готовая подпись `SIG_K1_…`. Это та же операция, что внутри
 * `@wharfkit/wallet-plugin-privatekey`, но ключ берётся из RAM-keystore (2.2), а
 * не из аргумента: десктопный `WalletPluginCoopId` делегирует сюда `sign()`, и
 * wharfkit `Session.transact()` подписывает чужими руками, не зная ключа.
 *
 * Вход — hex-строка signing-дайджеста (`transaction.signingDigest(chainId)`),
 * чтобы не тащить wharfkit-типы через границу пакета (иначе ловушка двойного
 * `Checksum256` из разных копий antelope). Бросает `WalletLocked`, если заперт.
 */
export async function signChainDigest(digestHex: string): Promise<string> {
  currentView() // бросает WalletLocked, если keystore заперт
  const { PrivateKey, Checksum256 } = await import('@wharfkit/antelope')
  const signature = PrivateKey.from(readUnlockedKey()).signDigest(Checksum256.from(digestHex))
  return signature.toString()
}

export interface TimestampSignature {
  ts: string
  binding_token_jti: string
  sub: string
  signature: string
  public_key: string
}

/**
 * Каноническое сообщение, которое подписывается и которое сервер обязан собрать
 * байт-в-байт для `recoverMessage` (`/coop/verify/timestamp`, Story 1.7). Ключи в
 * фиксированном алфавитном порядке — детерминизм между клиентом и сервером.
 * Экспортируется, чтобы controller переиспользовал ту же канонизацию.
 */
export function canonicalTimestampMessage(payload: { ts: string, binding_token_jti: string, sub: string }): string {
  return JSON.stringify({ binding_token_jti: payload.binding_token_jti, sub: payload.sub, ts: payload.ts })
}

/**
 * Локальная подпись документа ключом пайщика (Story 2.3). Возвращает compact JWS
 * `<header>.<payload>.<signature>` (alg=ES256K). Полностью офлайн: без сети и без
 * `audit_events` — сервер о подписи не знает (AC: подпись неоспорима и не зависит
 * от состояния сервера).
 *
 * Подпись делается тем же кросс-рантайм secp256k1-примитивом, что и `signTimestamp`
 * (`@wharfkit/antelope`): jose в браузере ES256K не умеет (WebCrypto без secp256k1),
 * поэтому compact JWS собирается вручную, а K1-подпись сериализуется в JWS-формат
 * R||S (recovery-байт отбрасывается — верификация по pubkey, не recover). `kid` в
 * заголовке = COOPOS-аккаунт подписанта (разрешение ключа при верификации, Story 2.5).
 */
export async function signDocument(params: SignDocumentParams): Promise<string> {
  const alg = params.alg ?? 'ES256K'
  if (alg !== 'ES256K')
    throw new AuthV2Error(AuthV2ErrorCode.ChainVerificationFailed, `Неподдерживаемый алгоритм подписи: ${alg}`)

  const { account } = currentView() // бросает WalletLocked, если заперт
  const wif = readUnlockedKey()

  const payloadBytes = typeof params.payload === 'string'
    ? new TextEncoder().encode(params.payload)
    : params.payload

  const header = base64url.encode(JSON.stringify({ alg, kid: account }))
  const payloadB64 = base64url.encode(payloadBytes)
  const signingInput = `${header}.${payloadB64}`

  const { PrivateKey } = await import('@wharfkit/antelope')
  const sig = PrivateKey.from(wif).signMessage(new TextEncoder().encode(signingInput))
  // K1-подпись сериализуется как [recovery(1), r(32), s(32)] = 65б; JWS ES256K = R||S
  // (64б) — recovery-байт не нужен (верификация по pubkey, не recover).
  const rs = sig.data.array.slice(1)
  return `${signingInput}.${base64url.encode(rs)}`
}

/**
 * Подпись метки времени для второго этапа auth (Story 2.4). Берёт `sub`/`jti` из
 * активного `session_binding_token` (Эпик 1: читаем claims без верификации —
 * подпись делает локальный ключ, доверие даёт сервер при verify), подписывает
 * каноническое `{ ts, binding_token_jti, sub }` COOPOS-native recoverable
 * подписью (SIG_K1_..., секрет — из keystore 2.2). Схема самоописана префиксом
 * SIG_K1_ — alg не хардкодим. Результат уходит в `/coop/verify/timestamp`, где
 * сервер `recoverMessage` → сверяет pubkey с COOPOS `get_account`.
 */
export async function signTimestamp(params: { sessionBindingToken: string }): Promise<TimestampSignature> {
  let claims: { sub?: string, jti?: string }
  try {
    claims = decodeJwt(params.sessionBindingToken)
  }
  catch {
    throw new AuthV2Error(AuthV2ErrorCode.SessionBindingExpired, 'Некорректный session_binding_token: не удалось прочитать claims')
  }
  const sub = claims.sub
  const jti = claims.jti
  if (!sub || !jti)
    throw new AuthV2Error(AuthV2ErrorCode.SessionBindingExpired, 'session_binding_token без обязательных claims sub/jti')

  // Кошелёк должен принадлежать тому же субъекту, что и токен (иначе подпишем
  // метку чужим ключом — сервер всё равно отвергнет, но ловим раньше и понятнее).
  const wallet = currentView() // бросает WalletLocked, если заперт
  if (wallet.account !== sub)
    throw new AuthV2Error(AuthV2ErrorCode.ClientWalletMismatch, `Разблокированный кошелёк (${wallet.account}) не совпадает с субъектом токена (${sub})`)

  const ts = new Date().toISOString()
  const message = canonicalTimestampMessage({ ts, binding_token_jti: jti, sub })

  const { PrivateKey } = await import('@wharfkit/antelope')
  const pk = PrivateKey.from(readUnlockedKey())
  const signature = pk.signMessage(new TextEncoder().encode(message))

  return {
    ts,
    binding_token_jti: jti,
    sub,
    signature: signature.toString(),
    public_key: pk.toPublic().toString(),
  }
}
