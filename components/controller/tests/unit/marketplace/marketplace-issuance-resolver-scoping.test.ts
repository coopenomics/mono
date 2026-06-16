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
 * Сиблинги #207. Те же инварианты для payload-резолверов (превью акта по
 * order_id раскрывает ФИО/состав заказа):
 *   - chairman-payload (sign:first, operator) → член КУ заказа;
 *   - orderer-payload  (sign:final, есть у каждого пайщика) → заказчик заказа.
 */
const orderOf = (overrides: Record<string, unknown>) =>
  ({ coopname: 'voskhod', orderer_account: 'owner', delivery_braname: 'krg', ...overrides } as any);

const makePayloadResolver = (order: any, isMember: boolean) => {
  const service = {
    getOpenIssuanceSignablePayload: jest.fn().mockResolvedValue({}),
  } as any;
  const orderRepo = { findById: jest.fn().mockResolvedValue(order) } as any;
  const kuChairmanService = { isMemberOfBranch: jest.fn().mockResolvedValue(isMember) } as any;
  const displayService = { enrich: jest.fn().mockResolvedValue(new Map()) } as any;
  const resolver = new MarketplaceIssuanceResolver(service, orderRepo, kuChairmanService, displayService);
  return { resolver, service, orderRepo, kuChairmanService };
};

describe('marketplaceIssueActChairmanSignablePayload ownership-scoping', () => {
  it('operator-член КУ заказа → превью отдаётся', async () => {
    const { resolver, service, kuChairmanService } = makePayloadResolver(orderOf({}), true);
    await resolver.marketplaceIssueActChairmanSignablePayload(asMember(['operator']), {
      order_id: 'o1',
    } as any);
    expect(kuChairmanService.isMemberOfBranch).toHaveBeenCalledWith('voskhod', 'krg', 'op');
    expect(service.getOpenIssuanceSignablePayload).toHaveBeenCalledWith(
      'voskhod',
      'o1',
      'op',
      undefined,
      undefined
    );
  });

  it('operator НЕ член КУ заказа → ForbiddenException, сервис не дёргается', async () => {
    const { resolver, service } = makePayloadResolver(orderOf({ delivery_braname: 'msk' }), false);
    await expect(
      resolver.marketplaceIssueActChairmanSignablePayload(asMember(['operator']), {
        order_id: 'o1',
      } as any)
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(service.getOpenIssuanceSignablePayload).not.toHaveBeenCalled();
  });
});
