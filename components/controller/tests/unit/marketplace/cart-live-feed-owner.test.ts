/**
 * Корзина — личная таблица ленты изменений: сигнал адресуется владельцу по
 * строке (orderer_account). Любое изменение корзины сохраняет строку целиком.
 *
 * До 25.09.2026 состав и пункт выдачи меняли корзину частичным update, и
 * подписчик ленты получал строку без владельца: сигнал уходил совету с пустым
 * ключом, а заказчик его не получал, и корзина на его столе не обновлялась.
 */
import { MarketplaceCartRepositoryAdapter } from '~/extensions/marketplace/infrastructure/adapters/marketplace-cart-repository.adapter';

function makeAdapter() {
  const cart = { id: 'cart-1', coopname: 'voskhod', orderer_account: 'ekaterina', delivery_braname: 'krg', updated_at: new Date(0) };
  const cartRepo = {
    findOneBy: jest.fn(async () => ({ ...cart })),
    save: jest.fn(async (row: any) => row),
    update: jest.fn(),
  } as any;
  const itemRepo = { findOne: jest.fn(async () => null), save: jest.fn(), create: jest.fn((r: any) => r), update: jest.fn(), delete: jest.fn() } as any;
  return { adapter: new MarketplaceCartRepositoryAdapter(cartRepo, itemRepo, {} as any), cartRepo };
}

describe('корзина сохраняется целой строкой с владельцем', () => {
  it('изменение состава', async () => {
    const { adapter, cartRepo } = makeAdapter();
    await adapter.upsertItem('cart-1', 'voskhod', 'offer-1', 'pkg-1', 2);
    expect(cartRepo.update).not.toHaveBeenCalled();
    expect(cartRepo.save).toHaveBeenCalledWith(expect.objectContaining({ id: 'cart-1', orderer_account: 'ekaterina' }));
  });

  it('смена пункта выдачи', async () => {
    const { adapter, cartRepo } = makeAdapter();
    await adapter.setDeliveryBraname('cart-1', 'odn');
    expect(cartRepo.update).not.toHaveBeenCalled();
    expect(cartRepo.save).toHaveBeenCalledWith(expect.objectContaining({ orderer_account: 'ekaterina', delivery_braname: 'odn' }));
  });
});
