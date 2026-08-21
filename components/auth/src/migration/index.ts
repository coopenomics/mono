/**
 * Миграция действующего пайщика «ключ → пароль» (Story 11.4), клиентская сторона.
 *
 * Пайщик сейчас владеет только WIF (легаси, без пароля). `migrate` доказывает
 * владение ключом подписью метки времени (как легаси `login`), сервер проверяет
 * её против он-чейн active-permission и ставит пароль в authentik (Story 11.1).
 *
 * РОТАЦИЯ (по умолчанию): вместе с паролем клиент генерирует НОВУЮ пару ключей;
 * в vault (шифруется паролём, на сервер уходит только шифр) кладётся новый WIF,
 * новый публичный ключ сервер прописывает on-chain (`registrator::changekey`).
 * Старый ключ с этого момента мёртв: где бы пайщик его ни хранил, войти или
 * сменить пароль им больше нельзя. Сам новый ключ пайщику не показывается —
 * он живёт только в зашифрованном vault'е.
 *
 * `rotate: false` — режим регистрации: аккаунт только что создан, его ключ
 * никому не показывался, ротировать нечего (и нельзя: `changekey` доступен
 * только принятому пайщику). Тогда в vault шифруется ТЕКУЩИЙ ключ — старое
 * поведение. Кандидату, запросившему ротацию, сервер отвечает
 * `RotationUnavailable` — клиент прозрачно повторяет без ротации.
 *
 * Подпись биндится к новому паролю через `pw_hash`, а при ротации — ещё и к
 * новому публичному ключу через `pk`: перехваченный proof нельзя переиспользовать
 * ни с другим паролём, ни с подменённым ключом.
 */
import { AuthV2Error, AuthV2ErrorCode } from '../errors'
import { coopIdApiUrl } from '../oidc/client'
import type { EncryptedVaultBlob, VaultSubject } from '../vault'
import { encryptPrivateKey } from '../vault'
import { saveLocalVault, saveToVault, type StorageAdapter } from '../wallet'

export interface MigrateParams {
  email: string
  /** WIF, которым пайщик владеет сейчас (легаси-ключ из поля входа). */
  privateKey: string
  newPassword: string
  /**
   * Ротировать ключ (по умолчанию true): сгенерировать новую пару, старую —
   * погасить on-chain. false — режим регистрации (ключ никому не показан).
   */
  rotate?: boolean
  /** Если задано — сохранить локальную копию зашифрованного vault'а на устройстве. */
  storage?: StorageAdapter
}

export interface MigrateResult {
  username: string
  /** Ключ действительно ротирован on-chain (сервер подтвердил). */
  rotated: boolean
  /** WIF, который теперь лежит в vault: новый при ротации, исходный без неё. */
  privateKey: string
}

/**
 * Каноническое сообщение proof'а миграции — **зеркало** серверного
 * `canonicalMigrationMessage` (controller). Клиент и сервер собирают строку
 * байт-в-байт, иначе `recoverPublicKey` на сервере восстановит чужой ключ.
 * `pw_hash` — sha256-hex нового пароля; `pk` — новый публичный ключ (только
 * при ротации: без него поле отсутствует, а не пустует — форматы совпадают
 * со старыми клиентами).
 */
export function canonicalMigrationMessage(payload: { ts: string, pw_hash: string, pk?: string }): string {
  if (payload.pk)
    return JSON.stringify({ pk: payload.pk, purpose: 'coopid-key-migration', pw_hash: payload.pw_hash, ts: payload.ts })
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
 * Выполнить миграцию «ключ → пароль» (с ротацией ключа по умолчанию).
 * Возвращает `{ username, rotated, privateKey }`. Бросает `AuthV2Error`:
 * InvalidCredentials (неверный ключ/email/подпись), WeakPassword,
 * TimestampTooOld, CooposDegraded, NetworkError.
 */
export async function migrate(params: MigrateParams): Promise<MigrateResult> {
  const apiUrl = coopIdApiUrl()
  const rotate = params.rotate !== false

  const { PrivateKey } = await import('@wharfkit/antelope')

  if (rotate) {
    // Новая пара: приватный — только в шифрованный vault, публичный — on-chain.
    const newKey = PrivateKey.generate('K1')
    try {
      return await migrateOnce(params, apiUrl, { newWif: newKey.toWif(), newPublicKey: newKey.toPublic().toString() })
    }
    catch (e) {
      // Кандидат (регистрация не завершена) ротировать не может — сервер отвечает
      // отдельным кодом; прозрачно повторяем без ротации с ТЕКУЩИМ ключом.
      if (e instanceof AuthV2Error && e.code === AuthV2ErrorCode.RotationUnavailable)
        return migrateOnce(params, apiUrl, null)
      throw e
    }
  }
  return migrateOnce(params, apiUrl, null)
}

async function migrateOnce(
  params: MigrateParams,
  apiUrl: string,
  rotation: { newWif: string, newPublicKey: string } | null,
): Promise<MigrateResult> {
  const ts = new Date().toISOString()
  const message = canonicalMigrationMessage({
    ts,
    pw_hash: await sha256Hex(params.newPassword),
    ...(rotation ? { pk: rotation.newPublicKey } : {}),
  })

  // Подпись текущим ключом (recoverable SIG_K1_). Невалидный WIF → понятная ошибка.
  const { PrivateKey } = await import('@wharfkit/antelope')
  let signature: string
  try {
    signature = PrivateKey.from(params.privateKey).signMessage(new TextEncoder().encode(message)).toString()
  }
  catch {
    throw new AuthV2Error(AuthV2ErrorCode.InvalidCredentials, 'Некорректный приватный ключ')
  }

  // При ротации блоб с НОВЫМ ключом едет в самом запросе: сервер сохранит его ДО
  // `changekey` (новый приватный ключ существует только в блобе — сначала укрытие,
  // потом переключение). AAD не зависит от account (см. vault/encrypt.ts).
  let vaultBlob: EncryptedVaultBlob | null = null
  if (rotation) {
    const subject: VaultSubject = { subject_type: 'participant', subject_id: '' }
    vaultBlob = await encryptPrivateKey(rotation.newWif, params.newPassword, subject)
  }

  let res: Response
  try {
    res = await fetch(`${apiUrl}/coop/migration`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: params.email,
        timestamp: ts,
        signature,
        new_password: params.newPassword,
        ...(rotation ? { new_public_key: rotation.newPublicKey, vault: vaultBlob } : {}),
      }),
    })
  }
  catch (e) {
    throw new AuthV2Error(AuthV2ErrorCode.NetworkError, `Сеть недоступна при миграции: ${e instanceof Error ? e.message : String(e)}`)
  }
  if (!res.ok)
    throw await authErrorFromResponse(res, AuthV2ErrorCode.InvalidCredentials, `Миграция отклонена (HTTP ${res.status})`)

  const body = (await res.json()) as { username?: string, rotated?: boolean }
  if (!body?.username)
    throw new AuthV2Error(AuthV2ErrorCode.ChainVerificationFailed, 'Миграция не вернула username')

  if (rotation) {
    // Сервер обязан был подтвердить ротацию: без подтверждения старый ключ жив,
    // а в vault лежал бы новый — рассинхрон, при котором вход по паролю невозможен.
    if (!body.rotated)
      throw new AuthV2Error(AuthV2ErrorCode.ChainVerificationFailed, 'Сервер не подтвердил ротацию ключа — обновите платформу кооператива')
    if (params.storage)
      await saveLocalVault(params.storage, body.username, vaultBlob as EncryptedVaultBlob)
    return { username: body.username, rotated: true, privateKey: rotation.newWif }
  }

  // Без ротации: зашифровать ТЕКУЩИЙ WIF новым паролём → server vault (обязательно)
  // + локальная копия. Ключ на сервер не уходит — только шифр.
  await saveToVault({ apiUrl, account: body.username, privateKey: params.privateKey, password: params.newPassword, storage: params.storage })
  return { username: body.username, rotated: false, privateKey: params.privateKey }
}
