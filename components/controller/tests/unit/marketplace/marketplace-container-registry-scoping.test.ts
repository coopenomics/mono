/**
 * Unit-тесты охвата реестра боксов и ячеек.
 *
 * Инвариант: право `read:all` (председатель, совет) означает «вся тара
 * кооператива», и фильтра по участкам в запросе быть не должно. Пустой список
 * участков — не «все», а «ни одного»: он превращается в `braname IN ()`, и
 * реестр стола администратора показывал «Боксы не найдены» при заведённой таре
 * (жалоба владельца 14.09.2026).
 *
 * Участки отбора считает общий гард (C28-87) и отдаёт их через
 * `@GrantedScope()`: весь кооператив — `kus: null`, оператору — его участки.
 * Резолвер подставляет итог в запрос; что гард отдаёт каждой роли, проверяет
 * marketplace-right-scopes.test.ts.
 */
jest.mock('~/config/config', () => ({
  __esModule: true,
  default: { coopname: 'voskhod' },
}));

import type { IGrantedScope } from '@coopenomics/extension-kit';
import { MarketplaceContainerResolver } from '~/extensions/marketplace/application/resolvers/marketplace-container.resolver';
import { MarketplaceStorageCellResolver } from '~/extensions/marketplace/application/resolvers/marketplace-storage-cell.resolver';

const everything: IGrantedScope = { scopes: ['all'], kus: null };
const branches = (...kus: string[]): IGrantedScope => ({ scopes: ['own-KU'], kus });

const makeContainerResolver = () => {
  const containerService = { list: jest.fn().mockResolvedValue([]) } as any;
  return { resolver: new MarketplaceContainerResolver(containerService), containerService };
};

const makeCellResolver = () => {
  const storageCellService = { list: jest.fn().mockResolvedValue([]) } as any;
  return { resolver: new MarketplaceStorageCellResolver(storageCellService), storageCellService };
};

describe('реестр боксов: охват выборки', () => {
  it('администратор без выбранного участка получает всю тару кооператива', async () => {
    const { resolver, containerService } = makeContainerResolver();

    await resolver.marketplaceListContainers(everything, undefined);

    expect(containerService.list).toHaveBeenCalledWith('voskhod', undefined, expect.anything());
  });

  it('администратор с выбранным участком получает этот участок', async () => {
    const { resolver, containerService } = makeContainerResolver();

    await resolver.marketplaceListContainers({ scopes: ['all'], kus: ['krg'] }, { braname: 'krg' } as any);

    expect(containerService.list).toHaveBeenCalledWith('voskhod', ['krg'], expect.anything());
  });

  it('участок без права на весь кооператив ограничивается своими КУ', async () => {
    const { resolver, containerService } = makeContainerResolver();

    await resolver.marketplaceListContainers(branches('krg', 'msk'), undefined);

    expect(containerService.list).toHaveBeenCalledWith(
      'voskhod',
      ['krg', 'msk'],
      expect.anything()
    );
  });

  it('оператор без участков получает пустой реестр, сервис не читается', async () => {
    const { resolver, containerService } = makeContainerResolver();

    await expect(resolver.marketplaceListContainers(branches(), undefined)).resolves.toEqual([]);

    expect(containerService.list).not.toHaveBeenCalled();
  });
});

describe('сетка ячеек: охват выборки', () => {
  it('администратор без выбранного участка видит склады всех участков', async () => {
    const { resolver, storageCellService } = makeCellResolver();

    await resolver.marketplaceListStorageCells(everything, undefined);

    expect(storageCellService.list).toHaveBeenCalledWith('voskhod', undefined, expect.anything());
  });

  it('оператор видит ячейки своих участков', async () => {
    const { resolver, storageCellService } = makeCellResolver();

    await resolver.marketplaceListStorageCells(branches('krg'), undefined);

    expect(storageCellService.list).toHaveBeenCalledWith('voskhod', ['krg'], expect.anything());
  });
});
