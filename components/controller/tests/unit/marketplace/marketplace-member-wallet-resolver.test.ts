/**
 * Unit-тесты MarketplaceMemberWalletResolver.
 *
 * Resolver возвращает массив 4-х USER_SHARED-кошельков стандарта marketplace:
 *   - `w.wal.share`  — паевые взносы деньгами (program_id=1).
 *   - `w.mkt.order`  — паевой резерв под Order (program_id=2). Введён 2026-05-28
 *                       взамен механики .blocked на программном кошельке.
 *   - `w.mkt.share`  — свободный паевой «Стола заказов» (program_id=2): туда
 *                       возвращается тело при отменах и возвратах, оттуда же
 *                       оплачивается тело следующих заказов.
 *   - `w.mkt.member` — членский взнос пайщика в программе (program_id=2):
 *                       оплачивает только взносы участка под следующие заказы.
 *
 * Каждый кошелёк со своим `name`/`human_name`/`available`/`blocked`, без
 * сворачивания. Источник — core `UserWalletRepository.findByUsername`
 * (PG-кеш `ledger2::userwallets`). Пайщик без L3-записи по конкретному
 * кошельку → `0/0` (рабочее состояние, а не ошибка) — например,
 * `w.mkt.order` появляется только после первого `createorder`.
 */

jest.mock('~/config/config', () => ({
  __esModule: true,
  default: { coopname: 'voskhod' },
}));

import { MarketplaceMemberWalletResolver } from '~/extensions/marketplace/application/resolvers/marketplace-member-wallet.resolver';

const makeRepo = (rows: any[]) =>
  ({
    findByUsername: jest.fn().mockResolvedValue(rows),
  } as any);

const member = {
  username: 'alice',
  status: 'active',
  core_roles: ['User'],
  marketplace_roles: ['orderer'],
};

describe('MarketplaceMemberWalletResolver', () => {
  it('пайщик с записями share + mkt.order → массив из 4 кошельков, свободный паевой и членский нулевые', async () => {
    const repo = makeRepo([
      { wallet_name: 'w.wal.share', available: '125.0000 RUB', blocked: '5.0000 RUB' },
      { wallet_name: 'w.mkt.order', available: '80.0000 RUB', blocked: '0.0000 RUB' },
      // нерелевантные стол-заказам кошельки не должны попасть в выдачу
      { wallet_name: 'w.cap.blago', available: '999.0000 RUB', blocked: '0.0000 RUB' },
    ]);
    const resolver = new MarketplaceMemberWalletResolver(repo);

    const dto = await resolver.marketplaceMemberWallet(member as any);

    expect(repo.findByUsername).toHaveBeenCalledWith('voskhod', 'alice');
    expect(dto.username).toBe('alice');
    expect(dto.coopname).toBe('voskhod');

    expect(dto.wallets).toHaveLength(4);
    expect(dto.wallets[0]).toMatchObject({
      name: 'w.wal.share',
      program_id: 1,
      label: 'Паевой | Цифровой Кошелёк',
      kind: 'USER_SHARED',
      available: '125.0000 RUB',
      blocked: '5.0000 RUB',
    });
    expect(dto.wallets[1]).toMatchObject({
      name: 'w.mkt.order',
      program_id: 2,
      label: 'Паевой резерв под заказы | Стол Заказов',
      available: '80.0000 RUB',
      blocked: '0.0000 RUB',
    });
    expect(dto.wallets[2]).toMatchObject({
      name: 'w.mkt.share',
      program_id: 2,
      label: 'Свободный паевой | Стол Заказов',
      available: '0',
      blocked: '0',
    });
    expect(dto.wallets[3]).toMatchObject({
      name: 'w.mkt.member',
      program_id: 2,
      label: 'Членский взнос | Стол Заказов',
      available: '0',
      blocked: '0',
    });
  });

  it('пайщик без L3-записей вообще → 4 кошелька с 0/0 (а не NotFoundException)', async () => {
    const repo = makeRepo([]);
    const resolver = new MarketplaceMemberWalletResolver(repo);

    const dto = await resolver.marketplaceMemberWallet(member as any);

    expect(dto.wallets).toHaveLength(4);
    for (const w of dto.wallets) {
      expect(w.available).toBe('0');
      expect(w.blocked).toBe('0');
    }
    expect(dto.wallets.map((w) => w.name)).toEqual([
      'w.wal.share',
      'w.mkt.order',
      'w.mkt.share',
      'w.mkt.member',
    ]);
  });

  it('human_name подтягивается из cooptypes LEDGER2_WALLET_REGISTRY', async () => {
    const repo = makeRepo([]);
    const resolver = new MarketplaceMemberWalletResolver(repo);

    const dto = await resolver.marketplaceMemberWallet(member as any);

    expect(dto.wallets[0].human_name).toBe('Паевой взнос пайщика');
    expect(dto.wallets[1].human_name).toBe('ЦПП «Стол Заказов» — паевой резерв под заказ у пайщика');
    expect(dto.wallets[2].human_name).toBe('ЦПП «Стол Заказов» — свободный паевой пайщика в программе');
  });

  it('w.mkt.payout (COOPERATIVE) не попадает в выдачу — это кооперативный кошелёк, не пайщика', async () => {
    const repo = makeRepo([
      { wallet_name: 'w.mkt.payout', available: '10000.0000 RUB', blocked: '0.0000 RUB' },
    ]);
    const resolver = new MarketplaceMemberWalletResolver(repo);

    const dto = await resolver.marketplaceMemberWallet(member as any);

    expect(dto.wallets.find((w) => w.name === 'w.mkt.payout')).toBeUndefined();
  });
});
