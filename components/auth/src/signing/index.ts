/**
 * Подпись: документы (Story 2.3) и timestamp-метка второго этапа аутентификации
 * (Story 2.4). Полностью локальные операции (без сети); подпись timestamp НЕ
 * создаёт audit_events.
 */
import { decodeJwt } from 'jose'
import { AuthV2Error, AuthV2ErrorCode, notImplemented } from '../errors'
import { currentView, readUnlockedKey } from '../wallet/storage'

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

/**
 * Каноническое сообщение, которое подписывается и которое сервер обязан собрать
 * байт-в-байт для `recoverMessage` (`/coop/verify/timestamp`, Story 1.7). Ключи в
 * фиксированном алфавитном порядке — детерминизм между клиентом и сервером.
 * Экспортируется, чтобы controller переиспользовал ту же канонизацию.
 */
export function canonicalTimestampMessage(payload: { ts: string, binding_token_jti: string, sub: string }): string {
  return JSON.stringify({ binding_token_jti: payload.binding_token_jti, sub: payload.sub, ts: payload.ts })
}

/** Подпись документа приватным ключом пайщика (client-side). Story 2.3. */
export async function signDocument(_document: unknown): Promise<SignedDocument> {
  notImplemented('signDocument')
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
