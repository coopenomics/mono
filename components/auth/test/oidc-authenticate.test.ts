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

vi.mock('oidc-client-ts', () => ({
  UserManager: class {
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

describe('authenticateWithAuthentik — тихий запрос после ввода пароля', () => {
  beforeEach(() => {
    calls.length = 0
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
})
