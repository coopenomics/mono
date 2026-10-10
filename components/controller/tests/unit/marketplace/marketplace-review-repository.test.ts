/**
 * Хранилище отзывов: что уходит в базу (задача 598-61, случаи mkt.review.*).
 *
 * Сводные оценки считаются только по опубликованным отзывам — скрытый отзыв
 * в среднюю не входит. Условия запросов держат именно это.
 */
import { MarketplaceReviewRepositoryAdapter } from '~/extensions/marketplace/infrastructure/adapters/marketplace-review-repository.adapter';
import { MarketplaceReviewStatuses } from '~/extensions/marketplace/domain/entities/marketplace-review.types';
import { MARKETPLACE_REVIEW_STORE } from '~/extensions/marketplace/infrastructure/database/marketplace-stores';
import { recordingKysely, type ScriptedResult } from '../helpers/kysely-recorder';
import { marketplaceStore } from './helpers/marketplace-store';

const COOP = 'voskhod';

function build(results: ScriptedResult[] = []) {
  const { db, queries } = recordingKysely(results);
  return { adapter: new MarketplaceReviewRepositoryAdapter(marketplaceStore(MARKETPLACE_REVIEW_STORE, db) as never), queries };
}

describe('сводные оценки предложений', () => {
  // mkt.review.happy.07
  it('оценки нескольких предложений — один запрос по опубликованным отзывам, средняя до десятых', async () => {
    const { adapter, queries } = build([
      { rows: [{ offer_id: 'off-1', count: '3', avg: '4.6666666666666667' }, { offer_id: 'off-2', count: '1', avg: '2' }] },
    ]);

    const ratings = await adapter.ratingsByOffers(COOP, ['off-1', 'off-2', 'off-3']);

    expect(queries).toHaveLength(1);
    expect(queries[0].sql).toContain('from "marketplace_review"');
    expect(queries[0].sql).toContain('"status" = ');
    expect(queries[0].sql).toContain('"offer_id" in (');
    expect(queries[0].sql).toContain('group by "offer_id"');
    expect(queries[0].parameters).toEqual(
      expect.arrayContaining([COOP, MarketplaceReviewStatuses.PUBLISHED, 'off-1', 'off-2', 'off-3'])
    );
    expect(ratings.get('off-1')).toEqual({ rating_avg: 4.7, reviews_count: 3 });
    expect(ratings.get('off-2')).toEqual({ rating_avg: 2, reviews_count: 1 });
    // Предложения без отзывов в ответе нет.
    expect(ratings.has('off-3')).toBe(false);
  });

  // mkt.review.side.17
  it('пустой перечень предложений в базу не ходит', async () => {
    const { adapter, queries } = build();

    await expect(adapter.ratingsByOffers(COOP, [])).resolves.toEqual(new Map());
    expect(queries).toHaveLength(0);
  });
});

describe('сводка с распределением по оценкам', () => {
  // mkt.review.happy.08
  it('сводка поставщика: пять строк от пяти звёзд к одной, средняя по всем отзывам', async () => {
    const { adapter, queries } = build([{ rows: [{ stars: 5, count: '3' }, { stars: 2, count: '1' }] }]);

    const summary = await adapter.summary(COOP, { supplier_account: 'sup1' });

    expect(queries[0].sql).toContain('"supplier_account" = ');
    expect(queries[0].sql).toContain('"status" = ');
    expect(queries[0].parameters).toEqual(expect.arrayContaining([COOP, MarketplaceReviewStatuses.PUBLISHED, 'sup1']));
    expect(summary.stars_breakdown).toEqual([
      { stars: 5, count: 3 },
      { stars: 4, count: 0 },
      { stars: 3, count: 0 },
      { stars: 2, count: 1 },
      { stars: 1, count: 0 },
    ]);
    expect(summary.reviews_count).toBe(4);
    // (5·3 + 2·1) / 4 = 4,25 → до десятых.
    expect(summary.rating_avg).toBe(4.3);
  });

  // mkt.review.side.18
  it('отзывов нет: оценки нет, счётчик ноль, пять пустых строк', async () => {
    const { adapter, queries } = build([{ rows: [] }]);

    const summary = await adapter.summary(COOP, { offer_id: 'off-1' });

    expect(queries[0].sql).toContain('"offer_id" = ');
    expect(summary.rating_avg).toBeNull();
    expect(summary.reviews_count).toBe(0);
    expect(summary.stars_breakdown).toHaveLength(5);
  });
});

describe('список отзывов', () => {
  // mkt.review.side.19
  it('знаки подстановки в строке поиска ищутся буквально, сортировка — только по разрешённому полю', async () => {
    const { adapter, queries } = build([{ rows: [] }, { rows: [{ count: '0' }] }]);

    const page = await adapter.list(
      { coopname: COOP, search: '100%_вкус', status: MarketplaceReviewStatuses.PUBLISHED },
      { page: 2, limit: 10, sortBy: 'author_account; drop table', sortOrder: 'ASC' }
    );

    expect(queries[0].sql).toContain('"text" ilike ');
    expect(queries[0].parameters).toEqual(expect.arrayContaining(['%100\\%\\_вкус%']));
    expect(queries[0].sql).toContain('order by "created_at" asc');
    expect(queries[0].sql).not.toContain('drop table');
    expect(page).toMatchObject({ items: [], totalCount: 0, totalPages: 1, currentPage: 2 });
  });
});
