/**
 * Стол заказов в общей ленте изменений (C28-83).
 *
 * Инварианты:
 *   - расширение объявляет свои таблицы в ленте: корзина — личная по
 *     заказчику, остальные открыты пайщикам кооператива; из цепи — настройки
 *     стола (сбор с оборота);
 *   - сигнал о записи шлёт слой базы, и ключ строки он берёт у таблицы базы:
 *     каждая объявленная таблица обязана быть таблицей расширения;
 *   - узел без порта ленты — объявление молчит и не падает;
 *   - готовый UPDATE счётчиков предложения слой базы не видит — сигнал шлёт
 *     хранилище само, и только когда строка действительно изменилась.
 */
import {
  MARKETPLACE_LIVE_CHAIN_TABLES,
  MARKETPLACE_LIVE_TABLES,
  MarketplaceLiveFeedSubscriber,
} from '~/extensions/marketplace/infrastructure/realtime/marketplace-live-feed.subscriber';
import { MarketplaceOfferRepositoryAdapter } from '~/extensions/marketplace/infrastructure/adapters/marketplace-offer-repository.adapter';
import { MarketplaceOfferStatuses } from '~/extensions/marketplace/domain/entities/marketplace-offer.types';
import marketplaceTables from '~/extensions/marketplace/marketplace.tables';
import { recordingKysely } from '../helpers/kysely-recorder';

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
    new MarketplaceLiveFeedSubscriber(chainChanges);

    expect(chainChanges.declareTables).toHaveBeenCalledWith(MARKETPLACE_LIVE_CHAIN_TABLES);
    expect(MARKETPLACE_LIVE_CHAIN_TABLES).toEqual([{ code: 'marketplace', table: 'config' }]);

    expect(chainChanges.declareLocalTables).toHaveBeenCalledWith(MARKETPLACE_LIVE_TABLES);
    const cart = MARKETPLACE_LIVE_TABLES.find((t) => t.table === 'marketplace_cart');
    expect(cart).toEqual({ code: 'market', table: 'marketplace_cart', owner_field: 'orderer_account' });
    const order = MARKETPLACE_LIVE_TABLES.find((t) => t.table === 'marketplace_order');
    expect(order).toEqual({ code: 'market', table: 'marketplace_order' });
  });

  it('каждая таблица ленты — таблица базы расширения: слой базы знает её ключ', () => {
    const declared = MARKETPLACE_LIVE_TABLES.map((entry) => entry.table);

    const known: readonly string[] = marketplaceTables;

    expect(declared.filter((table) => !known.includes(table))).toEqual([]);
  });

  it('без порта ленты — молчит и не падает', () => {
    expect(() => new MarketplaceLiveFeedSubscriber(null)).not.toThrow();
  });
});

describe('MarketplaceOfferRepositoryAdapter: сигнал после готового UPDATE счётчиков', () => {
  function build(updated: boolean) {
    const repo = {
      kysely: recordingKysely([{ rows: updated ? [{ id: 'of-1' }] : [] }]).db,
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
