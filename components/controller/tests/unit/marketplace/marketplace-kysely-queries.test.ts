/**
 * Хранилища Стола заказов на Kysely (C28-81): что уходит в базу.
 *
 * Перенос с TypeORM обязан сохранить условия запросов: по ним решается, какие
 * заказы попадут в партию, что видно на пункте выдачи и чей справочник
 * читается. Тесты держат именно условия — потеря любого из них меняет
 * поведение молча.
 */
import { MarketplaceOrderRepositoryAdapter } from '~/extensions/marketplace/infrastructure/adapters/marketplace-order-repository.adapter';
import { MarketplaceOfferRepositoryAdapter } from '~/extensions/marketplace/infrastructure/adapters/marketplace-offer-repository.adapter';
import { MarketplaceWriteoffProposalRepositoryAdapter } from '~/extensions/marketplace/infrastructure/adapters/marketplace-writeoff-proposal-repository.adapter';
import { MarketplaceContainerRepositoryAdapter } from '~/extensions/marketplace/infrastructure/adapters/marketplace-container-repository.adapter';
import { KuDetailsRepositoryAdapter } from '~/extensions/marketplace/infrastructure/adapters/ku-details-repository.adapter';
import { TypeRepositoryAdapter } from '~/extensions/marketplace/infrastructure/adapters/type-repository.adapter';
import {
  MARKETPLACE_CATALOG_CATEGORY_STORE,
  MARKETPLACE_CATALOG_TYPE_STORE,
  MARKETPLACE_CONTAINER_STORE,
  MARKETPLACE_KU_DETAILS_STORE,
  MARKETPLACE_OFFER_STORE,
  MARKETPLACE_ORDER_STORE,
  MARKETPLACE_WRITEOFF_PROPOSAL_STORE,
} from '~/extensions/marketplace/infrastructure/database/marketplace-stores';
import { recordingKysely, type ScriptedResult } from '../helpers/kysely-recorder';
import { marketplaceStore } from './helpers/marketplace-store';

const COOP = 'voskhod';
const mapper = { toDomain: (row: unknown) => row } as never;

function setup(token: symbol, results: ScriptedResult[] = []) {
  const { db, queries } = recordingKysely(results);
  return { store: marketplaceStore(token, db) as never, queries };
}

describe('заказы', () => {
  const build = (results: ScriptedResult[]) => {
    const { store, queries } = setup(MARKETPLACE_ORDER_STORE, results);
    const events = { emit: jest.fn() };
    return { adapter: new MarketplaceOrderRepositoryAdapter(store, mapper, events as never), queries, events };
  };

  it('в партию попадают только заказы без партии — условие стоит в самой правке', async () => {
    const before = { rows: [{ id: 'o1', status: 'ACTIVE' }, { id: 'o2', status: 'ACTIVE' }] };
    const { adapter, queries, events } = build([before, { affected: 1 }, before]);

    await expect(adapter.assignToCycle(['o1', 'o2'], 'c1', 'ACCEPTED' as never)).resolves.toBe(1);

    const update = queries[1];
    expect(update.sql).toContain('update "marketplace_order" set');
    expect(update.sql).toContain('"id" in (');
    expect(update.sql).toContain('"cycle_id" is null');
    expect(update.parameters).toEqual(expect.arrayContaining(['c1', 'ACCEPTED', 'o1', 'o2']));
    // Статус строк не изменился — сигнала о переходе нет.
    expect(events.emit).not.toHaveBeenCalled();
  });

  it('пустой перечень заказов в базу не ходит', async () => {
    const { adapter, queries } = build([]);

    await expect(adapter.assignToCycle([], 'c1', 'ACCEPTED' as never)).resolves.toBe(0);
    expect(queries).toHaveLength(0);
  });

  it('сумма активных заказов по предложению и участку считается одним запросом, числом', async () => {
    const { adapter, queries } = build([{ rows: [{ offer_id: 'of1', delivery_braname: 'krg', total: '5.000' }] }]);

    await expect(adapter.sumActiveByOfferBranch(COOP, ['of1'])).resolves.toEqual([
      { offer_id: 'of1', delivery_braname: 'krg', total: 5 },
    ]);
    expect(queries).toHaveLength(1);
    expect(queries[0].sql).toContain('GROUP BY offer_id, delivery_braname');
    expect(queries[0].parameters).toEqual([COOP, ['of1'], 'ACTIVE']);
  });

  it('открытые расчёты с поставщиком: свой кооператив и выплаченные заказы в отбор не попадают', async () => {
    const { adapter, queries } = build([{ rows: [] }]);

    await adapter.listOpenSupplierSettlements(COOP);

    expect(queries[0].sql).toContain('"supplier_account" <> ');
    expect(queries[0].sql).toContain('"payout_status" is null or "payout_status" <> ');
    expect(queries[0].sql).toContain('"accepted_cost" is not null or "status" in (');
    expect(queries[0].sql).toContain('order by "accepted_at" asc');
  });
});

describe('предложения', () => {
  const build = (results: ScriptedResult[]) => {
    const { store, queries } = setup(MARKETPLACE_OFFER_STORE, results);
    return { adapter: new MarketplaceOfferRepositoryAdapter(store, mapper, null), queries };
  };

  it('витрина пункта выдачи: только доступное и только то, что возят на этот пункт', async () => {
    const { adapter, queries } = build([{ rows: [] }, { rows: [{ count: '3' }] }]);

    const page = await adapter.list(
      { coopname: COOP, available_only: true, delivery_braname: 'krg' },
      { page: 1, limit: 20, sortBy: 'price', sortOrder: 'ASC' } as never
    );

    expect(page).toMatchObject({ totalCount: 3, totalPages: 1, currentPage: 1 });
    expect(queries[0].sql).toContain('(unlimited_flag = true OR quantity_available > 0)');
    expect(queries[0].sql).toContain('delivery_points @> ');
    expect(queries[0].sql).toContain('order by "price_per_unit" asc, "created_at" desc');
    expect(queries[0].parameters).toEqual(expect.arrayContaining([COOP, JSON.stringify([{ braname: 'krg' }])]));
    // Счёт идёт по тем же условиям, что и страница.
    expect(queries[1].sql).toContain('delivery_points @> ');
  });

  it('сортировка — только по своему перечню колонок: чужое имя даёт порядок по дате создания', async () => {
    const { adapter, queries } = build([{ rows: [] }, { rows: [{ count: '0' }] }]);

    await adapter.list({ coopname: COOP }, { page: 1, limit: 20, sortBy: 'id; drop table users', sortOrder: 'DESC' } as never);

    expect(queries[0].sql).toContain('order by "created_at" desc');
    expect(queries[0].sql).not.toContain('drop table');
  });
});

describe('списания', () => {
  it('список предложений о списании: отбор по статусам, свежие первыми, счёт по тем же условиям', async () => {
    const { store, queries } = setup(MARKETPLACE_WRITEOFF_PROPOSAL_STORE, [{ rows: [] }, { rows: [{ count: '12' }] }]);
    const adapter = new MarketplaceWriteoffProposalRepositoryAdapter(store, mapper);

    const page = await adapter.list({ coopname: COOP, statuses: ['DRAFT'] } as never, { page: 2, limit: 10 } as never);

    expect(page.total).toBe(12);
    expect(queries[0].sql).toContain('"status" in (');
    expect(queries[0].sql).toContain('order by "created_at" desc');
    expect(queries[0].parameters).toEqual(expect.arrayContaining([COOP, 'DRAFT', 10]));
    expect(queries[1].sql).toContain('count(*)');
    expect(queries[1].sql).toContain('"status" in (');
  });
});

describe('склад участка', () => {
  it('боксы без места на нескольких участках: перечень участков и пустая ячейка', async () => {
    const { store, queries } = setup(MARKETPLACE_CONTAINER_STORE, [{ rows: [] }]);
    const adapter = new MarketplaceContainerRepositoryAdapter(store, mapper);

    await adapter.list({ coopname: COOP, braname: ['krg', 'odn'], unplaced_only: true } as never);

    expect(queries[0].sql).toContain('"braname" in (');
    expect(queries[0].sql).toContain('"cell_id" is null');
    expect(queries[0].sql).toContain('order by "code" asc');
    expect(queries[0].parameters).toEqual([COOP, 'krg', 'odn']);
  });
});

describe('реквизиты участка', () => {
  it('действующие участки кооператива — по дате заведения', async () => {
    const { store, queries } = setup(MARKETPLACE_KU_DETAILS_STORE, [{ rows: [] }]);
    const adapter = new KuDetailsRepositoryAdapter(store);

    await expect(adapter.findByCoopname(COOP, { onlyActive: true })).resolves.toEqual([]);

    expect(queries[0].sql).toContain('"coopname" = $1');
    expect(queries[0].sql).toContain('"status" = $2');
    expect(queries[0].sql).toContain('order by "created_at" asc');
  });
});

describe('справочник типов', () => {
  it('тип отдаётся со своей категорией: категория читается отдельным запросом по ключу', async () => {
    const { db, queries } = recordingKysely([
      { rows: [{ type_id: 5, type_name: 'Мёд', disabled: false, description_category_id: 9 }] },
      { rows: [{ description_category_id: 9, category_name: 'Продукты', disabled: false, parent_id: null }] },
    ]);
    const adapter = new TypeRepositoryAdapter(
      marketplaceStore(MARKETPLACE_CATALOG_TYPE_STORE, db) as never,
      marketplaceStore(MARKETPLACE_CATALOG_CATEGORY_STORE, db) as never
    );

    const type = await adapter.findById(5);

    expect(type?.category.categoryName).toBe('Продукты');
    expect(queries).toHaveLength(2);
    expect(queries[0].sql).toContain('from "types"');
    expect(queries[1].sql).toContain('from "categories"');
    expect(queries[1].parameters).toEqual([9]);
  });
});
