/**
 * Публикация обезличенного остатка кооператива в каталог.
 *
 * Остаток перепредлагают дешевле цены прибытия: продажа дороже потребовала бы
 * доходной проводки, которой в модели нет, а уценка закрывается расходом
 * (o.mkt.loss) при выдаче. Отсюда жёсткий потолок цены.
 *
 * Остальные гарды защищают от публикации того, что публиковать нельзя:
 * адресной позиции под чужой заказ, уже зарезервированной позиции, позиции
 * другого кооператива и позиции, физически ушедшей со склада.
 */
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { MarketplaceStockService } from '~/extensions/marketplace/application/services/marketplace-stock.service';
import type { MarketplaceInventoryDomainRepository } from '~/extensions/marketplace/domain/repositories/marketplace-inventory.repository';
import type { MarketplaceOfferDomainRepository } from '~/extensions/marketplace/domain/repositories/marketplace-offer.repository';
import type { MarketplaceOrderDomainRepository } from '~/extensions/marketplace/domain/repositories/marketplace-order.repository';
import type { MarketplaceCanonicalBlockchainPort } from '~/extensions/marketplace/domain/ports/marketplace-canonical-blockchain.port';
import type { MarketplaceAssetConfig } from '~/extensions/marketplace/application/services/marketplace-asset.config';

const COOP = 'voskhod';
const INV_ID = 'inv-1';

/** Свободная позиция остатка: пришла по 250 ₽, лежит на складе krg. */
function buildPosition(overrides: Record<string, unknown> = {}) {
  return {
    id: INV_ID,
    coopname: COOP,
    braname: 'krg',
    ownership: 'COOP',
    reserved_order_id: null,
    published_offer_id: null,
    status: 'RECEIVED',
    quantity_per_label: 2,
    arrival_price: '250.0000',
    product_name_snapshot: 'Берёзовый сок',
    order_id: 'order-1',
    ...overrides,
  } as any;
}

function buildService(position: unknown) {
  const inventoryRepo = {
    findById: jest.fn().mockResolvedValue(position),
    list: jest.fn().mockResolvedValue([]),
    setPublication: jest.fn().mockResolvedValue(1),
  } as unknown as jest.Mocked<MarketplaceInventoryDomainRepository>;

  const orderRepo = {
    findByIds: jest.fn().mockResolvedValue([{ id: 'order-1', offer_id: 'origin-offer-1' }]),
  } as unknown as jest.Mocked<MarketplaceOrderDomainRepository>;

  const offerRepo = {
    findById: jest.fn().mockResolvedValue({
      id: 'origin-offer-1',
      coopname: COOP,
      product_name: 'Берёзовый сок',
      description: 'демо',
      category_id: 1,
      price_per_unit: '250.0000',
      unit_of_measure: 'piece',
      packages: [],
      shelf_life_days: 30,
    }),
    list: jest.fn().mockResolvedValue([]),
    create: jest.fn().mockResolvedValue({ id: 'coop-offer-1' }),
    update: jest.fn().mockResolvedValue({ id: 'coop-offer-1' }),
  } as unknown as jest.Mocked<MarketplaceOfferDomainRepository>;

  const service = new MarketplaceStockService(
    inventoryRepo,
    offerRepo,
    orderRepo,
    { onOrderBlocked: jest.fn(), onOrderRolledBack: jest.fn() } as any,
    {} as unknown as jest.Mocked<MarketplaceCanonicalBlockchainPort>,
    { symbol: 'RUB', decimals: 4 } as MarketplaceAssetConfig,
    { emit: jest.fn() } as any,
    { setContext: jest.fn(), log: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } as any
  );

  return { service, offerRepo, inventoryRepo };
}

const publish = (service: MarketplaceStockService, price?: string) =>
  service.publishStock({
    coopname: COOP,
    inventory_ids: [INV_ID],
    price_per_unit: price,
    warranty_days: 14,
  } as never);

describe('Публикация остатка: цена только вниз', () => {
  it('цена выше цены прибытия отбивается', async () => {
    const { service, offerRepo } = buildService(buildPosition());

    await expect(publish(service, '300.0000')).rejects.toBeInstanceOf(BadRequestException);
    expect(offerRepo.create).not.toHaveBeenCalled();
  });

  it('цена, равная цене прибытия, допустима', async () => {
    const { service, offerRepo } = buildService(buildPosition());

    await publish(service, '250.0000');

    expect(offerRepo.create).toHaveBeenCalled();
  });

  it('уценка проходит', async () => {
    const { service, offerRepo } = buildService(buildPosition());

    await publish(service, '200.0000');

    expect(offerRepo.create).toHaveBeenCalled();
  });

  it('нулевая и отрицательная цена не принимаются', async () => {
    const { service, offerRepo } = buildService(buildPosition());

    await expect(publish(service, '0')).rejects.toBeInstanceOf(BadRequestException);
    await expect(publish(service, '-10')).rejects.toBeInstanceOf(BadRequestException);
    expect(offerRepo.create).not.toHaveBeenCalled();
  });
});

describe('Публикация остатка: что публиковать нельзя', () => {
  it('адресная позиция под заказ пайщика — не остаток', async () => {
    const { service } = buildService(buildPosition({ ownership: 'ORDER' }));

    await expect(publish(service, '200.0000')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('позиция, уже зарезервированная под заказ из остатка', async () => {
    const { service } = buildService(buildPosition({ reserved_order_id: 'order-stock-1' }));

    await expect(publish(service, '200.0000')).rejects.toBeInstanceOf(ConflictException);
  });

  it('позиция другого кооператива', async () => {
    const { service } = buildService(buildPosition({ coopname: 'other' }));

    await expect(publish(service, '200.0000')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('позиция, ушедшая со склада', async () => {
    const { service } = buildService(buildPosition({ status: 'ISSUED' }));

    await expect(publish(service, '200.0000')).rejects.toBeInstanceOf(ConflictException);
  });

  it('позиция не найдена', async () => {
    const { service } = buildService(null);

    await expect(publish(service, '200.0000')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('уже опубликованную позицию повторно не публикуем', async () => {
    const { service } = buildService(buildPosition({ published_offer_id: 'coop-offer-1' }));

    await expect(publish(service, '200.0000')).rejects.toBeInstanceOf(ConflictException);
  });
});
