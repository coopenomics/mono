/**
 * Необязательное условие отбора, пришедшее пустым (`null`), значит «условие не
 * задано» — так же, как пропущенное поле. Стол шлёт `null` всякий раз, когда
 * фильтр не выбран; шлюз таблицы превращает `null` в `IS NULL`, поэтому
 * хранилище обязано отсечь его само. Иначе список приходит пустым при
 * заведённых записях: так 11.10.2026 пропали типы боксов кооператива.
 */
import { MarketplaceContainerRepositoryAdapter, MarketplaceContainerTypeRepositoryAdapter } from '~/extensions/marketplace/infrastructure/adapters/marketplace-container-repository.adapter';
import { MarketplaceInventoryRepositoryAdapter } from '~/extensions/marketplace/infrastructure/adapters/marketplace-inventory-repository.adapter';
import { MarketplaceReturnClaimRepositoryAdapter } from '~/extensions/marketplace/infrastructure/adapters/marketplace-return-claim-repository.adapter';
import {
  MARKETPLACE_CONTAINER_STORE,
  MARKETPLACE_CONTAINER_TYPE_STORE,
  MARKETPLACE_INVENTORY_STORE,
  MARKETPLACE_RETURN_CLAIM_STORE,
  marketplaceStoreProviders,
} from '~/extensions/marketplace/infrastructure/database/marketplace-stores';
import { recordingKysely } from '../helpers/kysely-recorder';
import { storeFrom } from '../helpers/table-store';

const COOP = 'voskhod';
/** Отображение записи в сущность тесту не нужно: строк в ответе нет. */
const mapper = { toDomain: (row: unknown) => row } as never;

function setup(token: symbol) {
  const { db, queries } = recordingKysely([{ rows: [] }]);
  return { store: storeFrom(marketplaceStoreProviders, token, db) as never, queries };
}

/** Пустой фильтр приходит от GraphQL как null, хотя тип поля его не называет. */
const EMPTY = null as unknown as undefined;

describe('пустое условие отбора не сужает список', () => {
  it('типы боксов: пустой признак оборота отдаёт все типы кооператива', async () => {
    const { store, queries } = setup(MARKETPLACE_CONTAINER_TYPE_STORE);
    const repo = new MarketplaceContainerTypeRepositoryAdapter(store, mapper);

    await repo.list(COOP, EMPTY);

    expect(queries).toHaveLength(1);
    expect(queries[0].sql).toContain('from "marketplace_container_type"');
    expect(queries[0].sql).not.toContain('is_active');
    expect(queries[0].parameters).toEqual([COOP]);
  });

  it('типы боксов: заданный признак оборота остаётся условием', async () => {
    const { store, queries } = setup(MARKETPLACE_CONTAINER_TYPE_STORE);
    const repo = new MarketplaceContainerTypeRepositoryAdapter(store, mapper);

    await repo.list(COOP, false);

    expect(queries[0].sql).toContain('"is_active" = $2');
    expect(queries[0].parameters).toEqual([COOP, false]);
  });

  it('боксы: пустые участок, признак оборота, тип и ячейка условий не дают', async () => {
    const { store, queries } = setup(MARKETPLACE_CONTAINER_STORE);
    const repo = new MarketplaceContainerRepositoryAdapter(store, mapper);

    await repo.list({ coopname: COOP, braname: EMPTY, is_active: EMPTY, container_type_id: EMPTY, cell_id: EMPTY });

    expect(queries).toHaveLength(1);
    expect(queries[0].sql).toContain('from "marketplace_container"');
    for (const column of ['braname', 'is_active', 'container_type_id', 'cell_id']) {
      expect(queries[0].sql).not.toContain(`"${column}" `);
    }
    expect(queries[0].parameters).toEqual([COOP]);
  });

  it('заявления на возврат: пустое состояние отдаёт все заявления участка, включая архив', async () => {
    const { store, queries } = setup(MARKETPLACE_RETURN_CLAIM_STORE);
    const repo = new MarketplaceReturnClaimRepositoryAdapter(store, mapper);

    await repo.listByDeliveryBraname(COOP, 'ku1', EMPTY);

    expect(queries).toHaveLength(1);
    expect(queries[0].sql).not.toContain('"status"');
    expect(queries[0].parameters).toEqual([COOP, 'ku1']);
  });

  it('остатки склада: пустой признак публикации не отбирает неопубликованное', async () => {
    const { store, queries } = setup(MARKETPLACE_INVENTORY_STORE);
    const repo = new MarketplaceInventoryRepositoryAdapter(store, mapper);

    await repo.list({ coopname: COOP, published: EMPTY });

    expect(queries).toHaveLength(1);
    expect(queries[0].sql).not.toContain('published_offer_id');
    expect(queries[0].parameters).toEqual([COOP]);
  });
});
