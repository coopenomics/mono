import { AvailableCategoryRepositoryAdapter } from '~/extensions/marketplace/infrastructure/adapters/available-category-repository.adapter';
import { AvailableCategoryMapper } from '~/extensions/marketplace/infrastructure/mappers/available-category.mapper';
import { AvailableCategoryDomainEntity } from '~/extensions/marketplace/domain/entities/available-category-domain.entity';

/**
 * mkt.cat.side.10. Председатель ограничивает каталог набором категорий. До
 * 12.10.2026 новая запись уходила в хранилище с id 0: хранилище считало нуль
 * ключом и перезаписывало одну и ту же строку, и из набора выживала только
 * последняя категория.
 */

/** Хранилище с поведением настоящего: запись с id перезаписывает строку, без id — получает новый номер. */
function storeLikeDb() {
  const rows = new Map<number, any>();
  let seq = 0;
  const store = {
    findOne: jest.fn(async () => null),
    find: jest.fn(async () => [...rows.values()]),
    save: jest.fn(async (entity: any) => {
      const row = { ...entity };
      if (row.id === undefined) row.id = ++seq;
      rows.set(row.id, row);
      return row;
    }),
  };
  return { store, rows };
}

describe('ограничение каталога набором категорий (mkt.cat.side.10)', () => {
  it('три категории подряд — три строки, а не одна последняя', async () => {
    const { store, rows } = storeLikeDb();
    const adapter = new AvailableCategoryRepositoryAdapter(store as any);

    for (const categoryId of [3, 7, 11]) await adapter.addCategory('voskhod', categoryId, 'ant');

    expect(rows.size).toBe(3);
    expect([...rows.values()].map((r) => r.categoryId).sort((a, b) => a - b)).toEqual([3, 7, 11]);
  });

  it('новая запись уходит в хранилище без ключа; сохранённая — со своим ключом', () => {
    const fresh = new AvailableCategoryDomainEntity({ coopname: 'voskhod', categoryId: 3, typeId: undefined, addedBy: 'ant', isActive: true });
    expect(AvailableCategoryMapper.toEntity(fresh).id).toBeUndefined();

    const stored = new AvailableCategoryDomainEntity({ id: 42, coopname: 'voskhod', categoryId: 3, typeId: undefined, addedBy: 'ant', isActive: true });
    expect(AvailableCategoryMapper.toEntity(stored).id).toBe(42);
  });
});
