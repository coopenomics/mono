/**
 * Unit-тесты освобождения места при выбытии со склада.
 *
 * Инвариант: бокс и ячейка отвечают на вопрос «где имущество лежит сейчас».
 * Выданное пайщику и списанное на участке не лежит, поэтому переход в эти
 * состояния снимает место. Пока место оставалось, коробка числилась занятой
 * тем, чего на складе давно нет, и не выводилась из оборота (тестнет,
 * 14.09.2026).
 *
 * Возврат на склад (RETURNED) — наоборот, имущество снова на участке: место
 * трогать нельзя, его назначит оператор при раскладке.
 */
import { MarketplaceInventoryRepositoryAdapter } from '~/extensions/marketplace/infrastructure/adapters/marketplace-inventory-repository.adapter';
import { MarketplaceInventoryStatuses } from '~/extensions/marketplace/domain/entities/marketplace-inventory.types';

const makeAdapter = () => {
  const repo = {
    update: jest.fn().mockResolvedValue({ affected: 1 }),
    findOneOrFail: jest.fn().mockResolvedValue({ id: 'inv-1' }),
  } as any;
  const mapper = { toDomain: (row: unknown) => row } as any;
  const adapter = new MarketplaceInventoryRepositoryAdapter(repo, mapper);
  return { adapter, repo };
};

describe('позиция склада: место при смене состояния', () => {
  it('выдача пайщику освобождает бокс и ячейку', async () => {
    const { adapter, repo } = makeAdapter();

    await adapter.applyStatusTransition('inv-1', MarketplaceInventoryStatuses.ISSUED);

    expect(repo.update).toHaveBeenCalledWith(
      { id: 'inv-1' },
      { status: MarketplaceInventoryStatuses.ISSUED, container_id: null, cell_id: null }
    );
  });

  it('списание освобождает бокс и ячейку', async () => {
    const { adapter, repo } = makeAdapter();

    await adapter.applyStatusTransition('inv-1', MarketplaceInventoryStatuses.WRITTEN_OFF);

    expect(repo.update).toHaveBeenCalledWith(
      { id: 'inv-1' },
      { status: MarketplaceInventoryStatuses.WRITTEN_OFF, container_id: null, cell_id: null }
    );
  });

  it('возврат на склад место не трогает — его назначит оператор при раскладке', async () => {
    const { adapter, repo } = makeAdapter();

    await adapter.applyStatusTransition('inv-1', MarketplaceInventoryStatuses.RETURNED);

    expect(repo.update).toHaveBeenCalledWith(
      { id: 'inv-1' },
      { status: MarketplaceInventoryStatuses.RETURNED }
    );
  });
});
