/**
 * Склад участка: резолвер отбирает позиции по участкам, которые отдал гард (#205, C28-87).
 *
 * Чьи участки доступны пайщику, решает общий гард по праву `Warehouse:read:own-KU`
 * (случаи — marketplace-right-scopes.test.ts). Резолвер получает итог через
 * `@GrantedScope()` и только подставляет его в запрос:
 *   - весь кооператив (`kus: null`) → отбора по участкам нет;
 *   - список участков → отбор по ним;
 *   - пустой список → пустой ответ без запроса в хранилище.
 */
jest.mock('~/config/config', () => ({
  __esModule: true,
  default: { coopname: 'voskhod' },
}));

import type { IGrantedScope } from '@coopenomics/extension-kit';
import { MarketplaceInventoryResolver } from '~/extensions/marketplace/application/resolvers/marketplace-inventory.resolver';

const makeResolver = () => {
  const inventoryRepo = { list: jest.fn().mockResolvedValue([]) } as any;
  // Обогащение результата ФИО заказчиков и реквизитами КУ (см. resolver:
  // marketplaceListInventory зовёт их сразу после inventoryRepo.list) —
  // тесты отбора их содержимое не проверяют, только факт вызова list().
  const orderDisplay = {
    resolveAccountNames: jest.fn().mockResolvedValue(new Map()),
    enrichByOrderIds: jest.fn().mockResolvedValue(new Map()),
  } as any;
  const resolver = new MarketplaceInventoryResolver({} as any, inventoryRepo, orderDisplay);
  return { resolver, inventoryRepo };
};

const everything: IGrantedScope = { scopes: ['all'], kus: null };
const branches = (...kus: string[]): IGrantedScope => ({ scopes: ['own-KU'], kus });

describe('marketplaceListInventory: отбор по участкам от гарда', () => {
  it('весь кооператив → отбора по участкам нет', async () => {
    const { resolver, inventoryRepo } = makeResolver();
    await resolver.marketplaceListInventory(everything, undefined);
    expect(inventoryRepo.list).toHaveBeenCalledWith(
      expect.objectContaining({ coopname: 'voskhod', braname: undefined })
    );
  });

  it('свои участки оператора → отбор по всем его участкам', async () => {
    const { resolver, inventoryRepo } = makeResolver();
    await resolver.marketplaceListInventory(branches('krg', 'msk'), undefined);
    expect(inventoryRepo.list).toHaveBeenCalledWith(
      expect.objectContaining({ braname: ['krg', 'msk'] })
    );
  });

  it('участок запроса, который гард сверил → отбор по нему', async () => {
    const { resolver, inventoryRepo } = makeResolver();
    await resolver.marketplaceListInventory(branches('krg'), { braname: 'krg' } as any);
    expect(inventoryRepo.list).toHaveBeenCalledWith(
      expect.objectContaining({ braname: ['krg'] })
    );
  });

  it('участков нет → пустой ответ, хранилище не читается', async () => {
    const { resolver, inventoryRepo } = makeResolver();
    const res = await resolver.marketplaceListInventory(branches(), undefined);
    expect(res).toEqual([]);
    expect(inventoryRepo.list).not.toHaveBeenCalled();
  });
});
