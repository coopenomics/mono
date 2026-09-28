/**
 * Стол заказов в общей ленте изменений (C28-83).
 *
 * Инварианты:
 *   - подписчик объявляет таблицы расширения в ленте: корзина — личная по
 *     заказчику, остальные открыты пайщикам кооператива; из цепи — настройки
 *     стола (сбор с оборота);
 *   - запись в таблицу своей базы — сигнал через порт после фиксации;
 *   - таблица вне списка — тишина;
 *   - узел без порта ленты — подписчик молчит и не падает;
 *   - сырой UPDATE счётчиков предложения подписчик не видит — сигнал шлёт
 *     репозиторий сам, и только когда строка действительно изменилась.
 */
import {
  MARKETPLACE_LIVE_CHAIN_TABLES,
  MARKETPLACE_LIVE_TABLES,
  MarketplaceLiveFeedSubscriber,
} from '~/extensions/marketplace/infrastructure/realtime/marketplace-live-feed.subscriber';
import { MarketplaceOfferRepositoryAdapter } from '~/extensions/marketplace/infrastructure/adapters/marketplace-offer-repository.adapter';
import { MarketplaceOfferStatuses } from '~/extensions/marketplace/domain/entities/marketplace-offer.types';

function metadata(tableName: string) {
  return {
    tableName,
    primaryColumns: [{ getEntityValue: (row: Record<string, unknown>) => row.id }],
  } as any;
}

function port() {
  return {
    declareLocalTables: jest.fn(),
    declareTables: jest.fn(),
    publishLocal: jest.fn().mockResolvedValue(undefined),
  } as any;
}

describe('MarketplaceLiveFeedSubscriber', () => {
  it('объявляет таблицы расширения: корзина личная, остальные открыты; сбор с оборота из цепи', () => {
    const chainChanges = port();
    new MarketplaceLiveFeedSubscriber({ subscribers: [] } as any, chainChanges);

    expect(chainChanges.declareTables).toHaveBeenCalledWith(MARKETPLACE_LIVE_CHAIN_TABLES);
    expect(MARKETPLACE_LIVE_CHAIN_TABLES).toEqual([{ code: 'marketplace', table: 'config' }]);

    expect(chainChanges.declareLocalTables).toHaveBeenCalledWith(MARKETPLACE_LIVE_TABLES);
    const cart = MARKETPLACE_LIVE_TABLES.find((t) => t.table === 'marketplace_cart');
    expect(cart).toEqual({ code: 'market', table: 'marketplace_cart', owner_field: 'orderer_account' });
    const order = MARKETPLACE_LIVE_TABLES.find((t) => t.table === 'marketplace_order');
    expect(order).toEqual({ code: 'market', table: 'marketplace_order' });
  });

  it('регистрируется подписчиком базы расширения и шлёт сигнал после фиксации', () => {
    const chainChanges = port();
    const dataSource = { subscribers: [] as unknown[] } as any;
    const subscriber = new MarketplaceLiveFeedSubscriber(dataSource, chainChanges);
    expect(dataSource.subscribers).toContain(subscriber);

    const queryRunner = { isTransactionActive: true } as any;
    const row = { id: 'o-1', orderer_account: 'ivan' };
    subscriber.afterUpdate({ metadata: metadata('marketplace_order'), queryRunner, entity: row, databaseEntity: row } as any);
    expect(chainChanges.publishLocal).not.toHaveBeenCalled();

    subscriber.afterTransactionCommit({ queryRunner } as any);
    expect(chainChanges.publishLocal).toHaveBeenCalledWith('marketplace_order', 'o-1', row);
  });

  it('таблица вне списка — тишина', () => {
    const chainChanges = port();
    const subscriber = new MarketplaceLiveFeedSubscriber({ subscribers: [] } as any, chainChanges);

    subscriber.afterInsert({
      metadata: metadata('marketplace_migrations'),
      queryRunner: { isTransactionActive: false },
      entity: { id: '1' },
    } as any);

    expect(chainChanges.publishLocal).not.toHaveBeenCalled();
  });

  it('без порта ленты — молчит и не падает', () => {
    const subscriber = new MarketplaceLiveFeedSubscriber({ subscribers: [] } as any, null);

    expect(() =>
      subscriber.afterInsert({
        metadata: metadata('marketplace_order'),
        queryRunner: { isTransactionActive: false },
        entity: { id: 'o-2' },
      } as any),
    ).not.toThrow();
  });
});

describe('MarketplaceOfferRepositoryAdapter: сигнал после сырого UPDATE счётчиков', () => {
  function build(updated: boolean) {
    const repo = {
      query: jest.fn().mockResolvedValue(updated ? [[{ id: 'of-1' }], 1] : [[], 0]),
      findOne: jest.fn().mockResolvedValue({ id: 'of-1', status: MarketplaceOfferStatuses.ACTIVE }),
      findOneOrFail: jest.fn().mockResolvedValue({ id: 'of-1' }),
    } as any;
    const mapper = { toDomain: jest.fn((row) => row) } as any;
    const chainChanges = port();
    const adapter = new MarketplaceOfferRepositoryAdapter(repo, mapper, chainChanges);
    return { adapter, chainChanges };
  }

  it('резерв прошёл — сигнал по предложению', async () => {
    const { adapter, chainChanges } = build(true);

    const result = await adapter.applyBlockDelta('of-1', 2);

    expect(result.ok).toBe(true);
    expect(chainChanges.publishLocal).toHaveBeenCalledWith('marketplace_offer', 'of-1');
  });

  it('резерв не прошёл (нехватка) — сигнала нет', async () => {
    const { adapter, chainChanges } = build(false);

    const result = await adapter.applyBlockDelta('of-1', 2);

    expect(result).toEqual({ ok: false, reason: 'insufficient_available' });
    expect(chainChanges.publishLocal).not.toHaveBeenCalled();
  });
});
