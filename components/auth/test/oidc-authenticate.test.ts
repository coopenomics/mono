import { beforeEach, describe, expect, it, vi } from 'vitest'

const flowExecutorMock = vi.fn(async () => undefined)
const removeUser = vi.fn(async () => undefined)
const clearStaleState = vi.fn(async () => undefined)
const signinSilent = vi.fn(async () => ({ id_token: 'id', profile: { preferred_username: 'ant', sub: 'new-uuid' } }))
const calls: string[] = []

vi.mock('../src/oidc/flow-executor', () => ({
  authenticateWithFlowExecutor: (...args: unknown[]) => {
    calls.push('flow')
    return flowExecutorMock(...(args as []))
  },
  warmUpFlow: vi.fn(async () => undefined),
  DEFAULT_AUTHENTICATION_FLOW: 'default-authentication-flow',
}))

/** Настройки, с которыми создали UserManager — по ним проверяем цену входа. */
let capturedSettings: Record<string, unknown> = {}
/** Ронять ли основной путь (обычный запрос за кодом) — тогда пойдёт запасной кадр. */
let failFetch = false

const AUTHORIZE_URL = 'https://coop.example/application/o/authorize/?prompt=none'
const RETURN_URL = 'https://coop.example/auth/callback.html?code=abc&state=xyz'

vi.mock('oidc-client-ts', () => ({
  UserManager: class {
    constructor(settings: Record<string, unknown>) {
      capturedSettings = settings
    }

    settings = { silent_redirect_uri: 'https://coop.example/auth/callback.html' }
    // Внутренности библиотеки, которыми пользуется путь без кадра.
    _client = {
      createSigninRequest: async () => {
        calls.push('createSigninRequest')
        return { url: AUTHORIZE_URL }
      },
    }

    async _signinEnd(url: string) {
      calls.push('signinEnd')
      if (url !== RETURN_URL)
        throw new Error(`неожиданный адрес возврата: ${url}`)
      return signinSilent()
    }

    metadataService = { getMetadata: vi.fn(async () => ({})) }
    async removeUser() {
      calls.push('removeUser')
      return removeUser()
    }

    async clearStaleState() {
      calls.push('clearStaleState')
      return clearStaleState()
    }

    async signinSilent() {
      calls.push('signinSilent')
      return signinSilent()
    }
  },
}))

const ISSUER = 'https://coop.example/application/o/coopid/'

// Основной путь ходит обычным запросом: authentik отвечает редиректом на
// страницу возврата, и адрес, на котором запрос закончился, несёт код.
vi.stubGlobal('fetch', vi.fn(async () => {
  calls.push('fetch')
  if (failFetch)
    throw new TypeError('Failed to fetch')
  return { url: RETURN_URL, status: 200 } as unknown as Response
}))

describe('authenticateWithAuthentik — тихий запрос после ввода пароля', () => {
  beforeEach(() => {
    calls.length = 0
    capturedSettings = {}
    failFetch = false
    vi.clearAllMocks()
  })

  it('сбрасывает прежде сохранённого пайщика ДО тихого запроса', async () => {
    const { authenticateWithAuthentik, configureOidc } = await import('../src/oidc/client')
    configureOidc({ clientId: 'coopid-desktop', redirectUri: 'https://coop.example/auth/callback.html' })

    await authenticateWithAuthentik({ issuer: ISSUER, email: 'user@e.com', password: 'S3cret!' })

    // Порядок принципиален: сверка «тот же ли человек» опирается на запись в
    // хранилище, поэтому убрать её надо до запроса, а не после.
    expect(calls.indexOf('removeUser')).toBeGreaterThan(calls.indexOf('flow'))
    expect(calls.indexOf('removeUser')).toBeLessThan(calls.indexOf('createSigninRequest'))
    expect(calls).toContain('clearStaleState')
  })

  it('вход проходит, когда в хранилище лежит запись другого пайщика (иначе был бы login_required)', async () => {
    const { authenticateWithAuthentik, configureOidc } = await import('../src/oidc/client')
    configureOidc({ clientId: 'coopid-desktop', redirectUri: 'https://coop.example/auth/callback.html' })

    const user = await authenticateWithAuthentik({ issuer: ISSUER, email: 'user@e.com', password: 'S3cret!' })
    expect(user.profile.preferred_username).toBe('ant')
  })

  it('код берётся обычным запросом, кадр не открывается вовсе', async () => {
    const { authenticateWithAuthentik, configureOidc } = await import('../src/oidc/client')
    configureOidc({ clientId: 'coopid-desktop', redirectUri: 'https://coop.example/auth/callback.html' })

    const user = await authenticateWithAuthentik({ issuer: ISSUER, email: 'user@e.com', password: 'S3cret!' })

    // Кадр — навигация, и на ней браузер проверяет обновление service worker'а;
    // пока тот ставится, переход до сети не доходит. Обычный запрос навигацией
    // не является, поэтому основной путь идёт через него.
    expect(user.profile.preferred_username).toBe('ant')
    expect(calls).toContain('fetch')
    expect(calls).not.toContain('signinSilent')
  })

  it('основной путь не удался — вход доходит запасным кадром', async () => {
    const { authenticateWithAuthentik, configureOidc } = await import('../src/oidc/client')
    configureOidc({ clientId: 'coopid-desktop', redirectUri: 'https://coop.example/auth/callback.html' })
    // Сетевой отказ основного пути: запасным остаётся кадр, и его ожидание —
    // единственное, что пайщик заметит, поэтому оно и ограничено порогом ниже.
    failFetch = true

    const user = await authenticateWithAuthentik({ issuer: ISSUER, email: 'user@e.com', password: 'S3cret!' })

    expect(user.profile.preferred_username).toBe('ant')
    expect(calls).toContain('signinSilent')
  })

  it('ожидание запасного кадра ограничено — иначе вход упирается в него целиком', async () => {
    const { authenticateWithAuthentik, configureOidc, SILENT_REQUEST_TIMEOUT_SECONDS } = await import('../src/oidc/client')
    configureOidc({ clientId: 'coopid-desktop', redirectUri: 'https://coop.example/auth/callback.html' })
    // Свой адрес кооператива: менеджеры кэшируются по нему, и на уже знакомом
    // адресе настройки не пересоздаются — проверять было бы нечего.
    const ownIssuer = 'https://own-coop.example/application/o/coopid/'

    await authenticateWithAuthentik({ issuer: ownIssuer, email: 'user@e.com', password: 'S3cret!' })

    // Это ожидание оплачивается целиком каждый раз, когда кадр не доносит ответ,
    // и целиком видно пайщику как «кнопка думает». Держать его длинным незачем:
    // паузу закрывает повтор. Порог сторожит регресс — было двадцать секунд.
    expect(capturedSettings.silentRequestTimeoutInSeconds).toBe(SILENT_REQUEST_TIMEOUT_SECONDS)
    expect(SILENT_REQUEST_TIMEOUT_SECONDS).toBeLessThanOrEqual(10)
  })
})
