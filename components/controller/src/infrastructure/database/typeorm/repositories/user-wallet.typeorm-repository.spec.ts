import type { Repository } from 'typeorm';
import { UserWalletTypeormRepository } from './user-wallet.typeorm-repository';
import { UserWalletTypeormEntity } from '../entities/user-wallet.typeorm-entity';

/**
 * Контракт удаляет строку кошелька при нулевом остатке, а копия в базе
 * остаётся надгробием (`present = false`) с последним ненулевым балансом.
 * Прикладные выборки обязаны такие строки не отдавать: иначе планировщик
 * оформления и панель кошелька показывают деньги, которых в цепи нет
 * (прецедент 14.09.2026: заявление о переводе недосчитано на 81 RUB).
 */
describe('UserWalletTypeormRepository — только живые строки', () => {
  const row = (
    id: string,
    wallet_name: string,
    available: string,
    present: boolean,
    username = 'ant'
  ): UserWalletTypeormEntity =>
    Object.assign(new UserWalletTypeormEntity(), {
      _id: `db-${id}`,
      _created_at: new Date(),
      _updated_at: new Date(),
      block_num: 1,
      present,
      id,
      coopname: 'voskhod',
      wallet_name,
      username,
      available,
      blocked: '0.0000 RUB',
    });

  // Надгробие членского кошелька (81) и живая строка с новым id (438) —
  // ровно то состояние базы, при котором случился отказ контракта.
  const table: UserWalletTypeormEntity[] = [
    row('7', 'w.mkt.member', '81.0000 RUB', false),
    row('120', 'w.mkt.member', '438.0000 RUB', true),
    row('9', 'w.mkt.share', '270.0000 RUB', false),
    row('84', 'w.wal.share', '71048.0000 RUB', true),
    row('85', 'w.wal.share', '10.0000 RUB', true, 'bob'),
  ];

  const matches = (entity: UserWalletTypeormEntity, where: Record<string, unknown>) =>
    Object.entries(where).every(([key, value]) => (entity as unknown as Record<string, unknown>)[key] === value);

  const typeorm = {
    find: jest.fn(async ({ where }: { where: Record<string, unknown> }) => table.filter((e) => matches(e, where))),
    findOne: jest.fn(
      async ({ where }: { where: Record<string, unknown> }) => table.find((e) => matches(e, where)) ?? null
    ),
  } as unknown as Repository<UserWalletTypeormEntity>;

  const repo = new UserWalletTypeormRepository(typeorm, {} as never);

  beforeEach(() => jest.clearAllMocks());

  it('findByUsername не отдаёт надгробия: членский — 438, свободного паевого нет', async () => {
    const rows = await repo.findByUsername('voskhod', 'ant');
    expect(rows.map((r) => [r.wallet_name, r.available])).toEqual([
      ['w.mkt.member', '438.0000 RUB'],
      ['w.wal.share', '71048.0000 RUB'],
    ]);
    expect(typeorm.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: { coopname: 'voskhod', username: 'ant', present: true } })
    );
  });

  it('findByWalletAndUsername: удалённый в цепи кошелёк — null, а не старый остаток', async () => {
    await expect(repo.findByWalletAndUsername('voskhod', 'w.mkt.share', 'ant')).resolves.toBeNull();
    const member = await repo.findByWalletAndUsername('voskhod', 'w.mkt.member', 'ant');
    expect(member?.available).toBe('438.0000 RUB');
    expect(typeorm.findOne).toHaveBeenCalledWith({
      where: { coopname: 'voskhod', wallet_name: 'w.mkt.member', username: 'ant', present: true },
    });
  });

  it('findByWallet и findByCoopname тоже фильтруют по present', async () => {
    const byWallet = await repo.findByWallet('voskhod', 'w.mkt.member');
    expect(byWallet.map((r) => r.id)).toEqual(['120']);

    const all = await repo.findByCoopname('voskhod');
    expect(all.map((r) => r.id).sort()).toEqual(['120', '84', '85']);
    expect(typeorm.find).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: { coopname: 'voskhod', present: true } })
    );
  });
});
