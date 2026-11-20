/**
 * Кэш состава участков сбрасывается по событиям цепи (замечание владельца
 * 19.11.2026): назначение председателя, доверенные лица, встречная подпись
 * доверенности сразу меняют «мои участки» на столе ПВЗ, без минутного
 * ожидания и без перезагрузки страницы.
 */
import { MarketplaceKuChairmanService } from '~/extensions/marketplace/application/services/marketplace-ku-chairman.service';

const COOP = 'voskhod';

function make() {
  let branches = [{ braname: 'romashka', trustee: 'petrov', trusted: [] as string[] }];
  const branchPort = { getBranches: jest.fn(async () => branches) } as any;
  const service = new MarketplaceKuChairmanService(branchPort);
  return { service, branchPort, setBranches: (next: typeof branches) => (branches = next) };
}

describe('Кэш состава участков', () => {
  it('без события состав держится в кэше', async () => {
    const { service, setBranches } = make();
    expect(await service.isKuChairman(COOP, 'ivanov')).toBe(false);
    setBranches([{ braname: 'romashka', trustee: 'ivanov', trusted: [] }]);
    expect(await service.isKuChairman(COOP, 'ivanov')).toBe(false);
  });

  it('дельта таблицы участков сбрасывает кэш кооператива', async () => {
    const { service, setBranches } = make();
    await service.isKuChairman(COOP, 'ivanov');
    setBranches([{ braname: 'romashka', trustee: 'ivanov', trusted: [] }]);
    service.onBranchesDelta({ scope: COOP } as any);
    expect(await service.isKuChairman(COOP, 'ivanov')).toBe(true);
  });

  it('встречная подпись доверенности сбрасывает кэш кооператива', async () => {
    const { service, setBranches, branchPort } = make();
    await service.listBranamesForMember(COOP, 'sidorov');
    setBranches([{ braname: 'romashka', trustee: 'petrov', trusted: ['sidorov'] }]);
    service.onAuthorityAction({ data: { coopname: COOP } });
    expect(await service.listBranamesForMember(COOP, 'sidorov')).toEqual(['romashka']);
    expect(branchPort.getBranches).toHaveBeenCalledTimes(2);
  });
});
