/** Реестр выхода: причины отказа и возврат, который выход ещё положит на кошельки программ. */
import { MemberExitRegistryService } from '~/domain/account/services/member-exit-registry.service';

const logger = { setContext: jest.fn(), debug: jest.fn(), warn: jest.fn() } as any;

describe('MemberExitRegistryService — возврат по обязательствам расширений', () => {
  it('собирает возврат со всех расширений, у которых он есть', async () => {
    const registry = new MemberExitRegistryService(logger);
    registry.registerExitBlockers({
      extension_name: 'edubridge',
      blockers: async () => [],
      pendingReturns: async () => [{ wallet_name: 'w.edu.member', human_name: 'Возврат по подпискам', amount: '250.0000 RUB' }],
    });
    registry.registerExitBlockers({ extension_name: 'market', blockers: async () => [] });
    expect(await registry.collectPendingReturns('voskhod', 'ant')).toEqual([
      { wallet_name: 'w.edu.member', human_name: 'Возврат по подпискам', amount: '250.0000 RUB' },
    ]);
  });

  it('нулевые суммы отбрасываются, сбой расширения выход не ломает', async () => {
    const registry = new MemberExitRegistryService(logger);
    registry.registerExitBlockers({
      extension_name: 'a',
      blockers: async () => [],
      pendingReturns: async () => [{ wallet_name: 'w.edu.member', human_name: 'ноль', amount: '0.0000 RUB' }],
    });
    registry.registerExitBlockers({
      extension_name: 'b',
      blockers: async () => [],
      pendingReturns: async () => {
        throw new Error('база недоступна');
      },
    });
    expect(await registry.collectPendingReturns('voskhod', 'ant')).toEqual([]);
    expect(logger.warn).toHaveBeenCalled();
  });
});
