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
/** Сколько раз тихий запрос падал, прежде чем вернуть пайщика. */
let failSilentTimes = 0

vi.mock('oidc-client-ts', () => ({
  UserManager: class {
    constructor(settings: Record<string, unknown>) {
      capturedSettings = settings
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
      if (failSilentTimes > 0) {
        failSilentTimes -= 1
        throw new Error('iframe window timed out')
      }
      return signinSilent()
    }
  },
}))

const ISSUER = 'https://coop.example/application/o/coopid/'

describe('authenticateWithAuthentik — тихий запрос после ввода пароля', () => {
  beforeEach(() => {
    calls.length = 0
    capturedSettings = {}
    failSilentTimes = 0
    vi.clearAllMocks()
  })

  it('сбрасывает прежде сохранённого пайщика ДО тихого запроса', async () => {
    const { authenticateWithAuthentik, configureOidc } = await import('../src/oidc/client')
    configureOidc({ clientId: 'coopid-desktop', redirectUri: 'https://coop.example/auth/callback.html' })

    await authenticateWithAuthentik({ issuer: ISSUER, email: 'user@e.com', password: 'S3cret!' })

    // Порядок принципиален: сверка «тот же ли человек» опирается на запись в
    // хранилище, поэтому убрать её надо до запроса, а не после.
    expect(calls.indexOf('removeUser')).toBeGreaterThan(calls.indexOf('flow'))
    expect(calls.indexOf('removeUser')).toBeLessThan(calls.indexOf('signinSilent'))
    expect(calls).toContain('clearStaleState')
  })

  it('вход проходит, когда в хранилище лежит запись другого пайщика (иначе был бы login_required)', async () => {
    const { authenticateWithAuthentik, configureOidc } = await import('../src/oidc/client')
    configureOidc({ clientId: 'coopid-desktop', redirectUri: 'https://coop.example/auth/callback.html' })

    const user = await authenticateWithAuthentik({ issuer: ISSUER, email: 'user@e.com', password: 'S3cret!' })
    expect(user.profile.preferred_username).toBe('ant')
  })

  it('теряется тихий запрос — вход доходит повтором, а не падает', async () => {
    const { authenticateWithAuthentik, configureOidc } = await import('../src/oidc/client')
    configureOidc({ clientId: 'coopid-desktop', redirectUri: 'https://coop.example/auth/callback.html' })
    // Ровно то, что видели на стенде 23.08.2026: запрос скрытого кадра браузер
    // оборвал (nginx записал 499), страница возврата не запрашивалась вовсе.
    failSilentTimes = 1

    const user = await authenticateWithAuthentik({ issuer: ISSUER, email: 'user@e.com', password: 'S3cret!' })

    expect(user.profile.preferred_username).toBe('ant')
    expect(calls.filter(c => c === 'signinSilent')).toHaveLength(2)
  })

  it('ожидание потерянного кадра не дороже повтора', async () => {
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
