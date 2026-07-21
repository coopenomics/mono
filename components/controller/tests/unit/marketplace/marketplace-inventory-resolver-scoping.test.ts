/**
 * Unit-тесты ownership-скоупинга marketplaceListInventory (#205).
 *
 * Инвариант: matrix даёт capability (`Warehouse:read:own-KU` оператору,
 * `read:all` админу/совету), а скоуп ДАННЫХ — ответственность резолвера.
 *   - admin/совет (read:all) → склад всего кооператива, braname как пришёл;
 *   - оператор (только read:own-KU) → ограничивается своими КУ:
 *       • без braname → IN (все свои КУ);
 *       • свой braname → этот braname;
 *       • чужой braname → ForbiddenException;
 *       • ноль своих КУ → пустой результат без запроса в репозиторий.
 */
jest.mock('~/config/config', () => ({
  __esModule: true,
  default: { coopname: 'voskhod' },
}));

import { ForbiddenException } from '@nestjs/common';
import { MarketplaceInventoryResolver } from '~/extensions/marketplace/application/resolvers/marketplace-inventory.resolver';

const makeResolver = (ownBranames: string[]) => {
  const inventoryRepo = { list: jest.fn().mockResolvedValue([]) } as any;
  const labelService = {} as any;
  const kuChairmanService = {
    listBranamesForMember: jest.fn().mockResolvedValue(ownBranames),
  } as any;
  // Обогащение результата ФИО заказчиков и реквизитами КУ (см. resolver:
  // marketplaceListInventory зовёт их сразу после inventoryRepo.list) —
  // тесты скоупинга их содержимое не проверяют, только факт вызова list().
  const orderDisplay = {
    resolveAccountNames: jest.fn().mockResolvedValue(new Map()),
    enrichByOrderIds: jest.fn().mockResolvedValue(new Map()),
  } as any;
  const resolver = new MarketplaceInventoryResolver(
    labelService,
    inventoryRepo,
    kuChairmanService,
    orderDisplay
  );
  return { resolver, inventoryRepo, kuChairmanService };
};

const asMember = (roles: string[]) =>
  ({ username: 'op', core_roles: ['User'], marketplace_roles: roles } as any);

describe('marketplaceListInventory ownership-scoping', () => {
  it('admin (read:all) без braname → НЕ скоупит, braname=undefined, КУ-сервис не дёргается', async () => {
    const { resolver, inventoryRepo, kuChairmanService } = makeResolver(['krg']);
    await resolver.marketplaceListInventory(asMember(['admin']), undefined);
    expect(kuChairmanService.listBranamesForMember).not.toHaveBeenCalled();
    expect(inventoryRepo.list).toHaveBeenCalledWith(
      expect.objectContaining({ coopname: 'voskhod', braname: undefined })
    );
  });

  it('board_readonly (read:all) с braname → braname как пришёл, без скоупа', async () => {
    const { resolver, inventoryRepo, kuChairmanService } = makeResolver(['krg']);
    await resolver.marketplaceListInventory(asMember(['board_readonly']), {
      braname: 'krg',
    } as any);
    expect(kuChairmanService.listBranamesForMember).not.toHaveBeenCalled();
    expect(inventoryRepo.list).toHaveBeenCalledWith(
      expect.objectContaining({ braname: 'krg' })
    );
  });

  it('operator без braname → скоуп IN по всем своим КУ', async () => {
    const { resolver, inventoryRepo } = makeResolver(['krg', 'msk']);
    await resolver.marketplaceListInventory(asMember(['operator']), undefined);
    expect(inventoryRepo.list).toHaveBeenCalledWith(
      expect.objectContaining({ braname: ['krg', 'msk'] })
    );
  });

  it('operator со своим braname → этот braname', async () => {
    const { resolver, inventoryRepo } = makeResolver(['krg', 'msk']);
    await resolver.marketplaceListInventory(asMember(['operator']), {
      braname: 'krg',
    } as any);
    expect(inventoryRepo.list).toHaveBeenCalledWith(
      expect.objectContaining({ braname: 'krg' })
    );
  });

  it('operator с ЧУЖИМ braname → ForbiddenException, репозиторий не дёргается', async () => {
    const { resolver, inventoryRepo } = makeResolver(['krg']);
    await expect(
      resolver.marketplaceListInventory(asMember(['operator']), {
        braname: 'msk',
      } as any)
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(inventoryRepo.list).not.toHaveBeenCalled();
  });

  it('operator без своих КУ → пустой массив, репозиторий не дёргается', async () => {
    const { resolver, inventoryRepo } = makeResolver([]);
    const res = await resolver.marketplaceListInventory(asMember(['operator']), undefined);
    expect(res).toEqual([]);
    expect(inventoryRepo.list).not.toHaveBeenCalled();
  });
});
