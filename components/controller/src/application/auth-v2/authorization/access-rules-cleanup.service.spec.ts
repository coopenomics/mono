import type { IAccessRulesRepository } from '~/domain/auth-v2/ports/access-rules.port';
import { AccessRulesCleanupService } from './access-rules-cleanup.service';

function makeService(deleteExpired = jest.fn(async () => 0)) {
  const repo: IAccessRulesRepository = {
    findForPrincipal: jest.fn(async () => []),
    findForCapabilitySets: jest.fn(async () => []),
    insert: jest.fn(async () => undefined),
    deleteExpired,
  };
  return { service: new AccessRulesCleanupService(repo), deleteExpired };
}

describe('AccessRulesCleanupService — уборка истёкших access_rules (Story 6.7)', () => {
  it('purgeExpired зовёт deleteExpired с текущим моментом (Date)', async () => {
    const { service, deleteExpired } = makeService(jest.fn(async () => 3));

    await service.purgeExpired();

    expect(deleteExpired).toHaveBeenCalledTimes(1);
    expect(deleteExpired).toHaveBeenCalledWith(expect.any(Date));
  });

  it('нечего удалять (0) → проходит без ошибок', async () => {
    const { service, deleteExpired } = makeService(jest.fn(async () => 0));
    await expect(service.purgeExpired()).resolves.toBeUndefined();
    expect(deleteExpired).toHaveBeenCalledTimes(1);
  });

  it('сбой репозитория пробрасывается (виден в логах планировщика, не глотается)', async () => {
    const { service } = makeService(jest.fn(async () => { throw new Error('db down'); }));
    await expect(service.purgeExpired()).rejects.toThrow('db down');
  });
});
