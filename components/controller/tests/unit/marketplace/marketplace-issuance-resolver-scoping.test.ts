/**
 * Unit-тесты ownership-скоупинга marketplaceListIssuancesByBraname (#206).
 *
 * Сиблинг #205. Инвариант: matrix даёт capability (`Issuance:read:own-KU`
 * оператору), а скоуп ДАННЫХ — ответственность резолвера:
 *   - роль с `Issuance:read:all` → лента любого КУ, КУ-сервис не дёргается;
 *   - оператор (только read:own-KU) обязан быть членом запрашиваемого КУ:
 *       • член КУ → лента этого КУ;
 *       • чужой КУ → ForbiddenException, репозиторий не дёргается.
 */
jest.mock('~/config/config', () => ({
  __esModule: true,
  default: { coopname: 'voskhod' },
}));

import { ForbiddenException } from '@nestjs/common';
import { MarketplaceIssuanceResolver } from '~/extensions/marketplace/application/resolvers/marketplace-issuance.resolver';

const makeResolver = (isMember: boolean) => {
  const service = {} as any;
  const orderRepo = { listForIssuanceByBraname: jest.fn().mockResolvedValue([]) } as any;
  const kuChairmanService = {
    isMemberOfBranch: jest.fn().mockResolvedValue(isMember),
  } as any;
  const displayService = { enrich: jest.fn().mockResolvedValue(new Map()) } as any;
  const resolver = new MarketplaceIssuanceResolver(service, orderRepo, kuChairmanService, displayService);
  return { resolver, orderRepo, kuChairmanService };
};

const asMember = (roles: string[]) =>
  ({ username: 'op', core_roles: ['User'], marketplace_roles: roles } as any);

describe('marketplaceListIssuancesByBraname ownership-scoping', () => {
  it('operator-член запрашиваемого КУ → лента отдаётся', async () => {
    const { resolver, orderRepo, kuChairmanService } = makeResolver(true);
    await resolver.marketplaceListIssuancesByBraname(asMember(['operator']), {
      delivery_braname: 'krg',
    } as any);
    expect(kuChairmanService.isMemberOfBranch).toHaveBeenCalledWith('voskhod', 'krg', 'op');
    expect(orderRepo.listForIssuanceByBraname).toHaveBeenCalledWith('voskhod', 'krg');
  });

  it('operator НЕ член запрашиваемого КУ → ForbiddenException, репозиторий не дёргается', async () => {
    const { resolver, orderRepo } = makeResolver(false);
    await expect(
      resolver.marketplaceListIssuancesByBraname(asMember(['operator']), {
        delivery_braname: 'msk',
      } as any)
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(orderRepo.listForIssuanceByBraname).not.toHaveBeenCalled();
  });
});

/**
 * Сиблинги #207. Те же инварианты для payload-резолверов: акт с подписью
 * заказчика (к закрывающей подписи оператора) раскрывает состав заказа —
 * отдаётся только члену КУ выдачи заказа.
 */
const orderOf = (overrides: Record<string, unknown>) =>
  ({ coopname: 'voskhod', orderer_account: 'owner', delivery_braname: 'krg', ...overrides } as any);

const makePayloadResolver = (order: any, ownBranames: string[]) => {
  const service = {
    getCloseSignablePayload: jest.fn().mockResolvedValue({ hash: 'h', rawDocument: { hash: 'h' }, document: { hash: 'h' } }),
    getSagaByOrder: jest.fn().mockResolvedValue(null),
  } as any;
  const orderRepo = { findById: jest.fn().mockResolvedValue(order) } as any;
  const kuChairmanService = { listBranamesForMember: jest.fn().mockResolvedValue(ownBranames) } as any;
  const displayService = { enrich: jest.fn().mockResolvedValue(new Map()) } as any;
  const resolver = new MarketplaceIssuanceResolver(service, orderRepo, kuChairmanService, displayService);
  return { resolver, service, orderRepo, kuChairmanService };
};

describe('marketplaceIssuanceClosePayload ownership-scoping', () => {
  it('operator-член КУ заказа → акт к закрывающей подписи отдаётся', async () => {
    const { resolver, service, kuChairmanService } = makePayloadResolver(orderOf({}), ['krg']);
    await resolver.marketplaceIssuanceClosePayload(asMember(['operator']), { order_id: 'o1' } as any);
    expect(kuChairmanService.listBranamesForMember).toHaveBeenCalledWith('voskhod', 'op');
    expect(service.getCloseSignablePayload).toHaveBeenCalledWith('voskhod', 'o1');
  });

  it('operator НЕ член КУ заказа → ForbiddenException, сервис не дёргается', async () => {
    const { resolver, service } = makePayloadResolver(orderOf({ delivery_braname: 'msk' }), ['krg']);
    await expect(
      resolver.marketplaceIssuanceClosePayload(asMember(['operator']), { order_id: 'o1' } as any)
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(service.getCloseSignablePayload).not.toHaveBeenCalled();
  });
});
