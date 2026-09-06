/**
 * Заказ обезличенного остатка кооператива: что отбивается до цепи.
 *
 * Остаток уже лежит на складе участка, поэтому цикла поставки у такого
 * заказа нет — позиции сразу резервируются под заказчика. Отсюда и главный
 * инвариант: зарезервировать больше свободного остатка нельзя, иначе на
 * выдаче не окажется имущества, за которое пайщик уже заплатил.
 *
 * Проверяются гарды, которые обязаны сработать ДО отправки в цепь: пустой
 * запрос, чужое предложение, неактивное предложение, предложение поставщика
 * (его заказывают обычным путём) и превышение остатка.
 */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { MarketplaceStockService } from '~/extensions/marketplace/application/services/marketplace-stock.service';
import type { MarketplaceOfferDomainRepository } from '~/extensions/marketplace/domain/repositories/marketplace-offer.repository';
import type { MarketplaceInventoryDomainRepository } from '~/extensions/marketplace/domain/repositories/marketplace-inventory.repository';
import type { MarketplaceOrderDomainRepository } from '~/extensions/marketplace/domain/repositories/marketplace-order.repository';
import type { MarketplaceCanonicalBlockchainPort } from '~/extensions/marketplace/domain/ports/marketplace-canonical-blockchain.port';
import type { MarketplaceAssetConfig } from '~/extensions/marketplace/application/services/marketplace-asset.config';

const COOP = 'voskhod';
const ORDERER = 'orderer2';

/** Опубликованный остаток участка krg: 5 единиц по 200 ₽. */
function buildStockOffer(overrides: Record<string, unknown> = {}) {
  return {
    id: 'offer-coop-1',
    coopname: COOP,
    stock_braname: 'krg',
    status: 'ACTIVE',
    quantity_available: 5,
    price_per_unit: '200.0000',
    unit_of_measure: 'piece',
    package_size: 0,
    warranty_days: 14,
    ...overrides,
  } as any;
}

function buildService(offer: unknown) {
  const offerRepo = {
    findById: jest.fn().mockResolvedValue(offer),
  } as unknown as jest.Mocked<MarketplaceOfferDomainRepository>;

  const inventoryRepo = {
    reserveStock: jest.fn().mockResolvedValue(5),
  } as unknown as jest.Mocked<MarketplaceInventoryDomainRepository>;

  const orderRepo = {
    // Заказ сохраняется уже после успешной отправки в цепь — до этого места
    // доходит только сценарий без отказов.
    persistAfterBlock: jest.fn().mockResolvedValue({ id: 'order-stock-1' }),
  } as unknown as jest.Mocked<MarketplaceOrderDomainRepository>;

  const offerCounters = {
    onOrderBlocked: jest.fn().mockResolvedValue(undefined),
    onOrderRolledBack: jest.fn().mockResolvedValue(undefined),
  } as any;

  const chainPort = {
    stockOrder: jest.fn().mockResolvedValue({ transaction: { id: 'tx-1' } }),
  } as unknown as jest.Mocked<MarketplaceCanonicalBlockchainPort>;

  const assetConfig: MarketplaceAssetConfig = { symbol: 'RUB', decimals: 4 };

  const logger = {
    setContext: jest.fn(),
    debug: jest.fn(),
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  } as any;

  const service = new MarketplaceStockService(
    inventoryRepo,
    offerRepo,
    orderRepo,
    offerCounters,
    chainPort,
    assetConfig,
    { emit: jest.fn() } as any,
    logger
  );

  return { service, chainPort, offerCounters };
}

const order = (quantity: number) => ({
  coopname: COOP,
  orderer_account: ORDERER,
  offer_id: 'offer-coop-1',
  quantity,
});

describe('Заказ остатка кооператива: гарды до цепи', () => {
  it('количество больше свободного остатка — отказ, счётчик не трогаем', async () => {
    const { service, chainPort, offerCounters } = buildService(buildStockOffer());

    await expect(service.createStockOrder(order(6) as never)).rejects.toBeInstanceOf(
      BadRequestException
    );
    expect(chainPort.stockOrder).not.toHaveBeenCalled();
    // Оптимистический счётчик двигается только после проверки остатка:
    // иначе отказ оставил бы предложение с занижённым доступным количеством.
    expect(offerCounters.onOrderBlocked).not.toHaveBeenCalled();
  });

  it('ровно весь свободный остаток заказать можно', async () => {
    const { service, chainPort } = buildService(buildStockOffer());

    await service.createStockOrder(order(5) as never);

    expect(chainPort.stockOrder).toHaveBeenCalled();
  });

  it('нулевое и отрицательное количество не проходят', async () => {
    const { service, chainPort } = buildService(buildStockOffer());

    await expect(service.createStockOrder(order(0) as never)).rejects.toBeInstanceOf(
      BadRequestException
    );
    await expect(service.createStockOrder(order(-1) as never)).rejects.toBeInstanceOf(
      BadRequestException
    );
    expect(chainPort.stockOrder).not.toHaveBeenCalled();
  });

  it('предложение поставщика этим путём не заказывается', async () => {
    // Без stock_braname это обычное предложение: у него есть цикл поставки,
    // и резервировать под него нечего.
    const { service, chainPort } = buildService(buildStockOffer({ stock_braname: null }));

    await expect(service.createStockOrder(order(1) as never)).rejects.toBeInstanceOf(
      BadRequestException
    );
    expect(chainPort.stockOrder).not.toHaveBeenCalled();
  });

  it('неактивное предложение остатка заказать нельзя', async () => {
    const { service, chainPort } = buildService(buildStockOffer({ status: 'PAUSED' }));

    await expect(service.createStockOrder(order(1) as never)).rejects.toBeInstanceOf(
      BadRequestException
    );
    expect(chainPort.stockOrder).not.toHaveBeenCalled();
  });

  it('предложение другого кооператива не находится', async () => {
    const { service, chainPort } = buildService(buildStockOffer({ coopname: 'other' }));

    await expect(service.createStockOrder(order(1) as never)).rejects.toBeInstanceOf(
      NotFoundException
    );
    expect(chainPort.stockOrder).not.toHaveBeenCalled();
  });
});
