/**
 * Миграция действующего пайщика «ключ → пароль» (Story 11.4), клиентская сторона.
 *
 * Пайщик сейчас владеет только WIF (легаси, без пароля). `migrate` доказывает
 * владение ключом подписью метки времени (как легаси `login`), сервер проверяет
 * её против он-чейн active-permission и ставит пароль в authentik (Story 11.1).
 * Затем клиент шифрует ТОТ ЖЕ WIF новым паролём в vault (Story 11.3) — приватный
 * ключ на сервер не уходит. Идемпотентно (повтор с тем же ключом/паролём безопасен).
 *
 * Подпись биндится к новому паролю через `pw_hash` в каноническом сообщении:
 * перехваченный proof нельзя переиспользовать с другим паролём.
 */
import { AuthV2Error, AuthV2ErrorCode } from '../errors'
import { coopIdApiUrl } from '../oidc/client'
import { saveToVault, type StorageAdapter } from '../wallet'

export interface MigrateParams {
  email: string
  /** WIF, которым пайщик владеет сейчас (легаси-ключ из поля входа). */
  privateKey: string
  newPassword: string
  /** Если задано — сохранить локальную копию зашифрованного vault'а на устройстве. */
  storage?: StorageAdapter
}

/**
 * Каноническое сообщение proof'а миграции — **зеркало** серверного
 * `canonicalMigrationMessage` (controller). Ключи в фиксированном алфавитном
 * порядке: клиент и сервер собирают строку байт-в-байт, иначе `recoverPublicKey`
 * на сервере восстановит чужой ключ. `pw_hash` — sha256-hex нового пароля.
 */
export function canonicalMigrationMessage(payload: { ts: string, pw_hash: string }): string {
  return JSON.stringify({ pw_hash: payload.pw_hash, purpose: 'coopid-key-migration', ts: payload.ts })
}

/** sha256-hex (lowercase) — байт-в-байт совпадает с серверным createHash('sha256').digest('hex'). */
async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('')
}

/** Разобрать OAuth2-ошибку контроллера ({ error, error_description }) в AuthV2Error. */
async function authErrorFromResponse(res: Response, fallback: AuthV2ErrorCode, fallbackMsg: string): Promise<AuthV2Error> {
  const body = (await res.json().catch(() => null)) as { error?: string, error_description?: string } | null
  return new AuthV2Error((body?.error as AuthV2ErrorCode) ?? fallback, body?.error_description ?? fallbackMsg)
}

/**
 * Выполнить миграцию «ключ → пароль». Возвращает `{ username }` (резолвится
 * сервером по email; нужен как subject vault'а). Бросает `AuthV2Error`:
 * InvalidCredentials (неверный ключ/email/подпись), WeakPassword, TimestampTooOld,
 * CooposDegraded, NetworkError.
 */
export async function migrate(params: MigrateParams): Promise<{ username: string }> {
  const apiUrl = coopIdApiUrl()
  const ts = new Date().toISOString()
  const message = canonicalMigrationMessage({ ts, pw_hash: await sha256Hex(params.newPassword) })

  // Подпись текущим ключом (recoverable SIG_K1_). Невалидный WIF → понятная ошибка.
  const { PrivateKey } = await import('@wharfkit/antelope')
  let signature: string
  try {
    signature = PrivateKey.from(params.privateKey).signMessage(new TextEncoder().encode(message)).toString()
  }
  catch {
    throw new AuthV2Error(AuthV2ErrorCode.InvalidCredentials, 'Некорректный приватный ключ')
  }

  let res: Response
  try {
    res = await fetch(`${apiUrl}/coop/migration`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: params.email, timestamp: ts, signature, new_password: params.newPassword }),
    })
  }
  catch (e) {
    throw new AuthV2Error(AuthV2ErrorCode.NetworkError, `Сеть недоступна при миграции: ${e instanceof Error ? e.message : String(e)}`)
  }
  if (!res.ok)
    throw await authErrorFromResponse(res, AuthV2ErrorCode.InvalidCredentials, `Миграция отклонена (HTTP ${res.status})`)

  const body = (await res.json()) as { username?: string }
  if (!body?.username)
    throw new AuthV2Error(AuthV2ErrorCode.ChainVerificationFailed, 'Миграция не вернула username')

  // Зашифровать текущий WIF новым паролём → server vault (обязательно) + локальная копия.
  await saveToVault({ apiUrl, account: body.username, privateKey: params.privateKey, password: params.newPassword, storage: params.storage })
  return { username: body.username }
}
