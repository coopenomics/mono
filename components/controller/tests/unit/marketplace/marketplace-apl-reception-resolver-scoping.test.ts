/**
 * Unit-тесты ownership-скоупинга apl-reception-резолверов (#208).
 *
 * Зеркало #205/#206/#207 на стороне приёмки. Инвариант: matrix даёт
 * capability, скоуп ДАННЫХ — ответственность резолвера:
 *   - listByBraname (operator, Receiving:create) → член запрашиваемого КУ;
 *   - supplierSignablePayloads (offerer, sign:first) → поставщик этой приёмки;
 *   - chairmanSignablePayloads (operator, sign:closing) → член КУ приёмки
 *       (сервис делает `void chairman_account`, скоупа сам не делает).
 * В каждом блоке: владелец/член → метод дёргается; чужой → ForbiddenException,
 * нижележащий метод не дёргается.
 */
// Конфиг подменяем поверх настоящего (он валиден благодаря tests/setup-env.ts):
// импорт резолвера тянет за собой модули расширений, а те читают blockchain/postgres
// прямо на верхнем уровне — от объекта с одним `coopname` они падают на импорте.
jest.mock('~/config/config', () => ({
  __esModule: true,
  default: { ...jest.requireActual('~/config/config').default, coopname: 'voskhod' },
}));

import { ForbiddenException } from '@nestjs/common';
import { MarketplaceAplReceptionResolver } from '~/extensions/marketplace/application/resolvers/marketplace-apl-reception.resolver';

const receptionOf = (overrides: Record<string, unknown>) =>
  ({ coopname: 'voskhod', braname: 'krg', offerer_account: 'op', ...overrides } as any);

const makeResolver = (reception: any, isMember: boolean) => {
  const service = {
    getSupplierSignablePayloads: jest.fn().mockResolvedValue([]),
    getChairmanSignablePayloads: jest.fn().mockResolvedValue([]),
  } as any;
  const receptionRepo = {
    findById: jest.fn().mockResolvedValue(reception),
    listByBraname: jest.fn().mockResolvedValue([]),
  } as any;
  const kuChairmanService = {
    isMemberOfBranch: jest.fn().mockResolvedValue(isMember),
  } as any;
  const displayService = {
    enrich: jest.fn().mockResolvedValue(new Map()),
  } as any;
  const resolver = new MarketplaceAplReceptionResolver(
    service,
    receptionRepo,
    kuChairmanService,
    displayService
  );
  return { resolver, service, receptionRepo, kuChairmanService, displayService };
};

const asMember = (roles: string[]) =>
  ({ username: 'op', core_roles: ['User'], marketplace_roles: roles } as any);

describe('marketplaceListAplReceptionsByBraname ownership-scoping', () => {
  it('operator-член запрашиваемого КУ → лента отдаётся', async () => {
    const { resolver, receptionRepo, kuChairmanService } = makeResolver(receptionOf({}), true);
    await resolver.marketplaceListAplReceptionsByBraname(asMember(['operator']), {
      braname: 'krg',
    } as any);
    expect(kuChairmanService.isMemberOfBranch).toHaveBeenCalledWith('voskhod', 'krg', 'op');
    expect(receptionRepo.listByBraname).toHaveBeenCalledWith('voskhod', 'krg');
  });

  it('operator НЕ член запрашиваемого КУ → ForbiddenException, репозиторий не дёргается', async () => {
    const { resolver, receptionRepo } = makeResolver(receptionOf({}), false);
    await expect(
      resolver.marketplaceListAplReceptionsByBraname(asMember(['operator']), {
        braname: 'msk',
      } as any)
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(receptionRepo.listByBraname).not.toHaveBeenCalled();
  });
});

describe('marketplaceAplReceptionSupplierSignablePayloads ownership-scoping', () => {
  it('поставщик своей приёмки → превью отдаётся', async () => {
    const { resolver, service } = makeResolver(receptionOf({ offerer_account: 'op' }), false);
    await resolver.marketplaceAplReceptionSupplierSignablePayloads(asMember(['offerer']), {
      apl_reception_id: 'r1',
    } as any);
    expect(service.getSupplierSignablePayloads).toHaveBeenCalledWith('voskhod', 'r1');
  });

  it('НЕ поставщик приёмки → ForbiddenException, сервис не дёргается', async () => {
    const { resolver, service } = makeResolver(receptionOf({ offerer_account: 'someoneelse' }), false);
    await expect(
      resolver.marketplaceAplReceptionSupplierSignablePayloads(asMember(['offerer']), {
        apl_reception_id: 'r1',
      } as any)
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(service.getSupplierSignablePayloads).not.toHaveBeenCalled();
  });
});

describe('marketplaceAplReceptionChairmanSignablePayloads ownership-scoping', () => {
  it('operator-член КУ приёмки → превью отдаётся', async () => {
    const { resolver, service, kuChairmanService } = makeResolver(receptionOf({}), true);
    await resolver.marketplaceAplReceptionChairmanSignablePayloads(asMember(['operator']), {
      apl_reception_id: 'r1',
    } as any);
    expect(kuChairmanService.isMemberOfBranch).toHaveBeenCalledWith('voskhod', 'krg', 'op');
    expect(service.getChairmanSignablePayloads).toHaveBeenCalledWith('voskhod', 'r1', 'op');
  });

  it('operator НЕ член КУ приёмки → ForbiddenException, сервис не дёргается', async () => {
    const { resolver, service } = makeResolver(receptionOf({ braname: 'msk' }), false);
    await expect(
      resolver.marketplaceAplReceptionChairmanSignablePayloads(asMember(['operator']), {
        apl_reception_id: 'r1',
      } as any)
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(service.getChairmanSignablePayloads).not.toHaveBeenCalled();
  });
});
