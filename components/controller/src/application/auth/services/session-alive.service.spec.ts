import { LEGACY_SESSION_CUTOFF, SessionAliveService } from './session-alive.service'

/**
 * Один ответ на вопрос «жива ли сессия» для обоих входов — HTTP и веб-сокета.
 * До 08.09.2026 ws проверял только подпись токена, и отозванный доступ оставался
 * наполовину живым: подписки и уведомления работали, HTTP отвечал отказом.
 */
describe('SessionAliveService', () => {
  function setup(opts: { session?: unknown; vaultBlob?: unknown; username?: string } = {}) {
    const tokenRepository = { findById: jest.fn().mockResolvedValue(opts.session ?? null) };
    const vault = { retrieve: jest.fn().mockResolvedValue(opts.vaultBlob ?? null) };
    const service = new SessionAliveService(tokenRepository as never, vault as never);
    return { service, tokenRepository, vault };
  }

  it('сессия на месте — доступ есть', async () => {
    const { service } = setup({ session: { id: 's1', blacklisted: false } })
    await expect(service.isAlive('s1', 'pgrzosdeyuwg')).resolves.toBe(true)
  })

  it('строку сессии удалили (выход, восстановление доступа) — доступа нет', async () => {
    const { service } = setup({ session: null })
    await expect(service.isAlive('s1', 'pgrzosdeyuwg')).resolves.toBe(false)
  })

  it('сессия в чёрном списке — доступа нет', async () => {
    const { service } = setup({ session: { id: 's1', blacklisted: true } })
    await expect(service.isAlive('s1', 'pgrzosdeyuwg')).resolves.toBe(false)
  })

  describe('до даты отключения токенов без привязки', () => {
    beforeEach(() => jest.spyOn(Date, 'now').mockReturnValue(LEGACY_SESSION_CUTOFF - 1))
    afterEach(() => jest.restoreAllMocks())

    it('токен без привязки к сессии у пайщика на ключе — уступка в силе, доступ есть', async () => {
      const { service } = setup({ vaultBlob: null })
      await expect(service.isAlive(undefined, 'pgrzosdeyuwg')).resolves.toBe(true)
    })

    it('токен без привязки у перешедшего на пароль — доступа нет', async () => {
      // Vault-блоб появляется ровно при установке пароля: миграцией или восстановлением.
      const { service } = setup({ vaultBlob: { cipher: 'x' } })
      await expect(service.isAlive(undefined, 'pgrzosdeyuwg')).resolves.toBe(false)
    })

    it('признак перехода на пароль спрашивается у хранилища один раз', async () => {
      const { service, vault } = setup({ vaultBlob: { cipher: 'x' } })
      await service.isAlive(undefined, 'pgrzosdeyuwg')
      await service.isAlive(undefined, 'pgrzosdeyuwg')
      expect(vault.retrieve).toHaveBeenCalledTimes(1)
    })
  })

  describe('после даты отключения', () => {
    beforeEach(() => jest.spyOn(Date, 'now').mockReturnValue(LEGACY_SESSION_CUTOFF))
    afterEach(() => jest.restoreAllMocks())

    it('токен без привязки не открывает доступ даже пайщику на ключе', async () => {
      // Отозвать такой токен иначе нечем: строки сессии у него нет.
      const { service, vault } = setup({ vaultBlob: null })
      await expect(service.isAlive(undefined, 'pgrzosdeyuwg')).resolves.toBe(false)
      expect(vault.retrieve).not.toHaveBeenCalled()
    })

    it('привязанная сессия работает как прежде', async () => {
      const { service } = setup({ session: { id: 's1', blacklisted: false } })
      await expect(service.isAlive('s1', 'pgrzosdeyuwg')).resolves.toBe(true)
    })
  })
})
