import { SessionAliveService } from './session-alive.service';

jest.mock('~/infrastructure/graphql/ws-session-check.registry', () => ({
  registerWsSessionCheck: jest.fn(),
}));

/**
 * Один ответ на вопрос «жива ли сессия» для обоих входов — HTTP и веб-сокета.
 * До 08.09.2026 ws проверял только подпись токена, и отозванный доступ оставался
 * наполовину живым: подписки и уведомления работали, HTTP отвечал отказом.
 */
describe('SessionAliveService', () => {
  function setup(opts: { session?: unknown; vaultBlob?: unknown; username?: string } = {}) {
    const tokenRepository = { findById: jest.fn().mockResolvedValue(opts.session ?? null) };
    const userRepository = {};
    const userDomainService = {};
    const vault = { retrieve: jest.fn().mockResolvedValue(opts.vaultBlob ?? null) };
    const service = new SessionAliveService(
      tokenRepository as never,
      userRepository as never,
      userDomainService as never,
      vault as never
    );
    return { service, tokenRepository, vault };
  }

  it('сессия на месте — доступ есть', async () => {
    const { service } = setup({ session: { id: 's1', blacklisted: false } });
    await expect(service.isAlive('s1', 'pgrzosdeyuwg')).resolves.toBe(true);
  });

  it('строку сессии удалили (выход, восстановление доступа) — доступа нет', async () => {
    const { service } = setup({ session: null });
    await expect(service.isAlive('s1', 'pgrzosdeyuwg')).resolves.toBe(false);
  });

  it('сессия в чёрном списке — доступа нет', async () => {
    const { service } = setup({ session: { id: 's1', blacklisted: true } });
    await expect(service.isAlive('s1', 'pgrzosdeyuwg')).resolves.toBe(false);
  });

  it('токен без привязки к сессии у пайщика на ключе — уступка в силе, доступ есть', async () => {
    const { service } = setup({ vaultBlob: null });
    await expect(service.isAlive(undefined, 'pgrzosdeyuwg')).resolves.toBe(true);
  });

  it('токен без привязки у перешедшего на пароль — доступа нет', async () => {
    // Vault-блоб появляется ровно при установке пароля: миграцией или восстановлением.
    const { service } = setup({ vaultBlob: { cipher: 'x' } });
    await expect(service.isAlive(undefined, 'pgrzosdeyuwg')).resolves.toBe(false);
  });

  it('признак перехода на пароль спрашивается у хранилища один раз', async () => {
    const { service, vault } = setup({ vaultBlob: { cipher: 'x' } });
    await service.isAlive(undefined, 'pgrzosdeyuwg');
    await service.isAlive(undefined, 'pgrzosdeyuwg');
    expect(vault.retrieve).toHaveBeenCalledTimes(1);
  });
});
