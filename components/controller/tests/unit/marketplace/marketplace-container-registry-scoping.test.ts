/**
 * Unit-тесты охвата реестра боксов и ячеек.
 *
 * Инвариант: право `read:all` (председатель, совет) означает «вся тара
 * кооператива», и фильтра по участкам в запросе быть не должно. Пустой список
 * участков — не «все», а «ни одного»: он превращается в `braname IN ()`, и
 * реестр стола администратора показывал «Боксы не найдены» при заведённой таре
 * (жалоба владельца 14.09.2026).
 *
 * Участок без права `read:all` по-прежнему ограничивается своими КУ.
 */
jest.mock('~/config/config', () => ({
  __esModule: true,
  default: { coopname: 'voskhod' },
}));

import { MarketplaceContainerResolver } from '~/extensions/marketplace/application/resolvers/marketplace-container.resolver';
import { MarketplaceStorageCellResolver } from '~/extensions/marketplace/application/resolvers/marketplace-storage-cell.resolver';

const asMember = (roles: string[]) =>
  ({ username: 'chairman', core_roles: ['Chairman'], marketplace_roles: roles }) as any;

const makeContainerResolver = (ownBranames: string[]) => {
  const containerService = { list: jest.fn().mockResolvedValue([]) } as any;
  const kuChairmanService = {
    listBranamesForMember: jest.fn().mockResolvedValue(ownBranames),
  } as any;
  const resolver = new MarketplaceContainerResolver(containerService, kuChairmanService);
  return { resolver, containerService };
};

const makeCellResolver = (ownBranames: string[]) => {
  const storageCellService = { list: jest.fn().mockResolvedValue([]) } as any;
  const kuChairmanService = {
    listBranamesForMember: jest.fn().mockResolvedValue(ownBranames),
  } as any;
  const resolver = new MarketplaceStorageCellResolver(storageCellService, kuChairmanService);
  return { resolver, storageCellService };
};

describe('реестр боксов: охват выборки', () => {
  it('администратор без выбранного участка получает всю тару кооператива', async () => {
    const { resolver, containerService } = makeContainerResolver(['krg']);

    await resolver.marketplaceListContainers(asMember(['admin']), undefined);

    expect(containerService.list).toHaveBeenCalledWith('voskhod', undefined, expect.anything());
  });

  it('администратор с выбранным участком получает этот участок', async () => {
    const { resolver, containerService } = makeContainerResolver(['krg']);

    await resolver.marketplaceListContainers(asMember(['admin']), { braname: 'krg' } as any);

    expect(containerService.list).toHaveBeenCalledWith('voskhod', 'krg', expect.anything());
  });

  it('участок без права на весь кооператив ограничивается своими КУ', async () => {
    const { resolver, containerService } = makeContainerResolver(['krg', 'msk']);

    await resolver.marketplaceListContainers(asMember(['operator']), undefined);

    expect(containerService.list).toHaveBeenCalledWith(
      'voskhod',
      ['krg', 'msk'],
      expect.anything()
    );
  });
});

describe('сетка ячеек: охват выборки', () => {
  it('администратор без выбранного участка видит склады всех участков', async () => {
    const { resolver, storageCellService } = makeCellResolver(['krg']);

    await resolver.marketplaceListStorageCells(asMember(['admin']), undefined);

    expect(storageCellService.list).toHaveBeenCalledWith('voskhod', undefined, expect.anything());
  });
});
