import { MarketplaceKuChairmanService } from './marketplace-ku-chairman.service';
import { type IBranchPort } from '@coopenomics/innercoop';

function buildPort(branches: Array<{ braname: string; trustee: string; trusted: string[] }>) {
  const port: Partial<IBranchPort> & {
    getBranches: jest.Mock;
  } = {
    getBranches: jest.fn().mockResolvedValue(branches),
  };
  return port as IBranchPort & { getBranches: jest.Mock };
}

describe('MarketplaceKuChairmanService', () => {
  describe('isKuChairman', () => {
    it('возвращает true для trustee любого КУ', async () => {
      const port = buildPort([
        { braname: 'krg', trustee: 'chairkrg', trusted: ['opkrg'] },
        { braname: 'myt', trustee: 'chairmyt', trusted: [] },
      ]);
      const service = new MarketplaceKuChairmanService(port);

      expect(await service.isKuChairman('voskhod', 'chairkrg')).toBe(true);
      expect(await service.isKuChairman('voskhod', 'chairmyt')).toBe(true);
    });

    it('возвращает true для trusted (равенство в правах с trustee)', async () => {
      const port = buildPort([
        { braname: 'krg', trustee: 'chairkrg', trusted: ['opkrg', 'trustedkrg'] },
      ]);
      const service = new MarketplaceKuChairmanService(port);

      expect(await service.isKuChairman('voskhod', 'opkrg')).toBe(true);
      expect(await service.isKuChairman('voskhod', 'trustedkrg')).toBe(true);
    });

    it('возвращает false для постороннего пайщика', async () => {
      const port = buildPort([
        { braname: 'krg', trustee: 'chairkrg', trusted: ['opkrg'] },
      ]);
      const service = new MarketplaceKuChairmanService(port);

      expect(await service.isKuChairman('voskhod', 'ivanpetrov')).toBe(false);
    });

    it('кеширует branches[] на TTL — повторный вызов не дёргает порт', async () => {
      const port = buildPort([
        { braname: 'krg', trustee: 'chairkrg', trusted: [] },
      ]);
      const service = new MarketplaceKuChairmanService(port);

      await service.isKuChairman('voskhod', 'chairkrg');
      await service.isKuChairman('voskhod', 'someoneelse');
      await service.isKuChairman('voskhod', 'chairkrg');

      expect(port.getBranches).toHaveBeenCalledTimes(1);
    });

    it('invalidate(coopname) сбрасывает кеш', async () => {
      const port = buildPort([
        { braname: 'krg', trustee: 'chairkrg', trusted: [] },
      ]);
      const service = new MarketplaceKuChairmanService(port);

      await service.isKuChairman('voskhod', 'chairkrg');
      service.invalidate('voskhod');
      await service.isKuChairman('voskhod', 'chairkrg');

      expect(port.getBranches).toHaveBeenCalledTimes(2);
    });
  });

  describe('isMemberOfBranch', () => {
    it('возвращает true только для членов конкретного branch (trustee или trusted)', async () => {
      const port = buildPort([
        { braname: 'krg', trustee: 'chairkrg', trusted: ['opkrg'] },
        { braname: 'myt', trustee: 'chairmyt', trusted: [] },
      ]);
      const service = new MarketplaceKuChairmanService(port);

      expect(await service.isMemberOfBranch('voskhod', 'krg', 'chairkrg')).toBe(true);
      expect(await service.isMemberOfBranch('voskhod', 'krg', 'opkrg')).toBe(true);
      // chairmyt — председатель myt, не krg
      expect(await service.isMemberOfBranch('voskhod', 'krg', 'chairmyt')).toBe(false);
      expect(await service.isMemberOfBranch('voskhod', 'unknown', 'chairkrg')).toBe(false);
    });
  });

  describe('listOperatorsOfBranch', () => {
    it('возвращает trustee + всех trusted', async () => {
      const port = buildPort([
        { braname: 'krg', trustee: 'chairkrg', trusted: ['opkrg', 'trustedkrg'] },
      ]);
      const service = new MarketplaceKuChairmanService(port);

      expect(await service.listOperatorsOfBranch('voskhod', 'krg')).toEqual([
        'chairkrg',
        'opkrg',
        'trustedkrg',
      ]);
    });

    it('пустой список для несуществующего КУ', async () => {
      const port = buildPort([]);
      const service = new MarketplaceKuChairmanService(port);

      expect(await service.listOperatorsOfBranch('voskhod', 'nope')).toEqual([]);
    });
  });

  describe('listBranamesForMember', () => {
    it('возвращает все КУ, где пайщик — trustee или trusted', async () => {
      const port = buildPort([
        { braname: 'krg', trustee: 'chairkrg', trusted: ['ekaterina'] },
        { braname: 'myt', trustee: 'chairmyt', trusted: [] },
        { braname: 'odn', trustee: 'chairodn', trusted: ['ekaterina'] },
      ]);
      const service = new MarketplaceKuChairmanService(port);

      expect(await service.listBranamesForMember('voskhod', 'ekaterina')).toEqual(['krg', 'odn']);
      expect(await service.listBranamesForMember('voskhod', 'chairmyt')).toEqual(['myt']);
      expect(await service.listBranamesForMember('voskhod', 'ivanpetrov')).toEqual([]);
    });
  });

  describe('getTrusteeOfBranch', () => {
    it('возвращает trustee существующего КУ', async () => {
      const port = buildPort([
        { braname: 'krg', trustee: 'chairkrg', trusted: ['opkrg'] },
      ]);
      const service = new MarketplaceKuChairmanService(port);

      expect(await service.getTrusteeOfBranch('voskhod', 'krg')).toBe('chairkrg');
    });

    it('возвращает null для несуществующего', async () => {
      const port = buildPort([]);
      const service = new MarketplaceKuChairmanService(port);

      expect(await service.getTrusteeOfBranch('voskhod', 'nope')).toBeNull();
    });
  });
});
