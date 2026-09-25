import { calcCostMinor } from '../shared/cost.util';
import { BadRequestException } from '@nestjs/common';
import { DomainError } from '@coopenomics/extension-kit';
import { MarketplaceCheckoutService } from './marketplace-checkout.service';
import { MarketplaceConvertService } from './marketplace-convert.service';
import { MarketplaceCheckoutOrderActionKind } from '../../domain/ports/marketplace-canonical-blockchain.port';
import { MarketplaceOfferStatuses, MarketplaceUnitsOfMeasure } from '../../domain/entities/marketplace-offer.types';
import type { MarketplaceOfferDomainEntity } from '../../domain/entities/marketplace-offer.entity';

/**
 * Решение владельца 15.09.2026: корзина оформляется одной транзакцией —
 * перевод по заявлению 1110 и заказы всех строк проходят или откатываются
 * вместе. До этого перевод шёл отдельной транзакцией и оставался проведённым,
 * когда контракт отказывал в заказе (519 RUB зависли в членском кошельке).
 */
describe('MarketplaceCheckoutService — одна транзакция на всё оформление', () => {
  const KU = 'ku.krasn.1';
  const scope = { coopname: 'voskhod', orderer_account: 'ant' };

  const offer = (overrides: Partial<MarketplaceOfferDomainEntity>): MarketplaceOfferDomainEntity =>
    ({
      coopname: 'voskhod',
      supplier_account: 'supplier1',
      product_name: 'Молоко',
      price_per_unit: '100.0000',
      unit_of_measure: MarketplaceUnitsOfMeasure.PIECE,
      packages: null,
      quantity_available: 10,
      unlimited_flag: false,
      delivery_points: [{ braname: KU, min_supply_volume: 1 }],
      warranty_days: 7,
      status: MarketplaceOfferStatuses.ACTIVE,
      stock_braname: null,
      ...overrides,
    }) as unknown as MarketplaceOfferDomainEntity;

  const supplierOffer = offer({ id: 'offer-a', product_name: 'Молоко' });
  const stockOffer = offer({ id: 'offer-b', product_name: 'Хлеб', supplier_account: 'voskhod', stock_braname: KU });

  const preparedA = { action: { order_hash: 'hash-a', offerer: 'supplier1' }, offer: supplierOffer } as any;
  const preparedB = { action: { order_hash: 'hash-b' }, offer: stockOffer } as any;
  const orderRow = (id: string) => ({ id, coopname: 'voskhod', order_hash: `hash-${id}`, orderer_account: 'ant' }) as any;
  const txOk = { response: { transaction_id: 'tx-1', processed: { id: 'tx-1', block_num: 42 } } };

  function build(balances: { member: bigint; share: bigint }) {
    const cartRepo = {
      getOrCreate: jest.fn(async () => ({
        id: 'cart-1',
        is_empty: false,
        delivery_braname: KU,
        items: [
          { offer_id: 'offer-a', package_id: '', quantity: 2 },
          { offer_id: 'offer-b', package_id: '', quantity: 1 },
        ],
      })),
      removeItems: jest.fn(async () => undefined),
    };
    const offerRepo = { findByIds: jest.fn(async () => [supplierOffer, stockOffer]) };
    const orderCreateService = {
      prepare: jest.fn(async () => preparedA),
      finalize: jest.fn(async () => ({ order: orderRow('a') })),
      rollback: jest.fn(async () => undefined),
    };
    const stockService = {
      prepareStockOrder: jest.fn(async () => preparedB),
      finalizeStockOrder: jest.fn(async () => ({ order: orderRow('b'), tx_hash: 'tx-1' })),
      rollbackStockOrder: jest.fn(async () => undefined),
    };
    const cartService = { getCart: jest.fn(async () => ({ items: [] })) };
    const economyService = {
      getMembershipFeeContractPercent: jest.fn(async () => 10),
      // Настоящий расчёт стоимости — подделка с BigInt(количество) прятала
      // падение на дробной мере (до 25.09.2026).
      lineBodyUnits: (sale: any, unit: any) =>
        calcCostMinor({ quantity: sale.baseQuantity, unit, unitPrice: sale.unitPrice, packageSize: sale.packageSize, decimals: 4 }),
      membershipFeeUnits: (body: bigint, pct: number) => (body * BigInt(pct)) / 100n,
      unitsToAsset: (u: bigint) => `${(Number(u) / 10_000).toFixed(4)} RUB`,
    };
    const convertService = {
      programBalances: jest.fn(async () => balances),
      planFunding: MarketplaceConvertService.prototype.planFunding,
      verifySigned: jest.fn(() => ({ hash: 'doc-1110' })),
      availableUnits: jest.fn(async () => 1_000_000_0000n),
    };
    const chainPort = { checkout: jest.fn(async (_input: unknown) => txOk) };
    const logger = { setContext: jest.fn(), log: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };

    const service = new MarketplaceCheckoutService(
      cartRepo as any,
      offerRepo as any,
      orderCreateService as any,
      stockService as any,
      cartService as any,
      economyService as any,
      convertService as any,
      chainPort as any,
      logger as any
    );
    return { service, cartRepo, offerRepo, orderCreateService, stockService, chainPort, convertService };
  }

  const withStatement = { member: 0n, share: 0n }; // кошельков программы нет — нужен перевод
  const withoutStatement = { member: 1_000_0000n, share: 10_000_0000n }; // всё покрыто кошельками программы

  it('перевод и заказы всех строк уходят одной транзакцией: перевод первым, строки в порядке корзины', async () => {
    const m = build(withStatement);

    const result = await m.service.execute(scope, { signed_convert: {} as any });

    expect(m.chainPort.checkout).toHaveBeenCalledTimes(1);
    const sent = m.chainPort.checkout.mock.calls[0][0] as any;
    expect(sent.coopname).toBe('voskhod');
    expect(sent.convert).toEqual(
      expect.objectContaining({
        orderer: 'ant',
        convert_statement: { hash: 'doc-1110' },
        targets: [
          { order_hash: expect.any(String), amount: '20.0000 RUB' },
          { order_hash: expect.any(String), amount: '10.0000 RUB' },
        ],
      })
    );
    expect(sent.orders).toEqual([
      { kind: MarketplaceCheckoutOrderActionKind.CREATE_ORDER, data: preparedA.action },
      { kind: MarketplaceCheckoutOrderActionKind.STOCK_ORDER, data: preparedB.action },
    ]);

    expect(m.orderCreateService.finalize).toHaveBeenCalledWith(preparedA, { tx_hash: 'tx-1', block_num: 42 });
    expect(m.stockService.finalizeStockOrder).toHaveBeenCalledWith(preparedB, 'tx-1');
    expect(m.cartRepo.removeItems).toHaveBeenCalledWith('cart-1', ['offer-a', 'offer-b']);
    expect(result.fully_completed).toBe(true);
    expect(result.created_orders.map((o) => o.id)).toEqual(['a', 'b']);
  });

  it('отказ цепи — отказ всего: брони всех строк сняты, заказы не записаны, корзина не тронута', async () => {
    const m = build(withStatement);
    m.chainPort.checkout.mockRejectedValue(
      new Error('assertion failure with message: Недостаточно членских средств Стола заказов на членский взнос участка\n')
    );

    await expect(m.service.execute(scope, { signed_convert: {} as any })).rejects.toThrow(/Недостаточно членских средств/);

    expect(m.orderCreateService.rollback).toHaveBeenCalledWith(preparedA);
    expect(m.stockService.rollbackStockOrder).toHaveBeenCalledWith(preparedB);
    expect(m.orderCreateService.finalize).not.toHaveBeenCalled();
    expect(m.stockService.finalizeStockOrder).not.toHaveBeenCalled();
    expect(m.cartRepo.removeItems).not.toHaveBeenCalled();
  });

  it('с заявлением строка, не прошедшая подготовку, отменяет оформление целиком — перевод без адресата не уходит', async () => {
    const m = build(withStatement);
    m.stockService.prepareStockOrder.mockRejectedValue(new BadRequestException('На складе доступно только 0 шт; нельзя заказать 1.'));

    await expect(m.service.execute(scope, { signed_convert: {} as any })).rejects.toThrow(/не все позиции корзины можно заказать.*«Хлеб»/);

    expect(m.chainPort.checkout).not.toHaveBeenCalled();
    expect(m.orderCreateService.rollback).toHaveBeenCalledWith(preparedA);
    expect(m.cartRepo.removeItems).not.toHaveBeenCalled();
  });

  it('без заявления непрошедшая строка остаётся в корзине, остальные оформляются одной транзакцией без перевода', async () => {
    const m = build(withoutStatement);
    m.stockService.prepareStockOrder.mockRejectedValue(new BadRequestException('На складе доступно только 0 шт; нельзя заказать 1.'));

    const result = await m.service.execute(scope, {});

    expect(m.convertService.verifySigned).not.toHaveBeenCalled();
    const sent = m.chainPort.checkout.mock.calls[0][0] as any;
    expect(sent.convert).toBeNull();
    expect(sent.orders).toEqual([{ kind: MarketplaceCheckoutOrderActionKind.CREATE_ORDER, data: preparedA.action }]);
    expect(m.cartRepo.removeItems).toHaveBeenCalledWith('cart-1', ['offer-a']);
    expect(result.fully_completed).toBe(false);
    expect(result.failed_lines).toEqual([expect.objectContaining({ offer_id: 'offer-b', product_name: 'Хлеб' })]);
  });

  it('все строки отсеялись до цепи — транзакция не отправляется', async () => {
    const m = build(withoutStatement);
    m.orderCreateService.prepare.mockRejectedValue(new BadRequestException('Доступно только 0 шт.'));
    m.stockService.prepareStockOrder.mockRejectedValue(new BadRequestException('На складе доступно только 0 шт.'));

    const result = await m.service.execute(scope, {});

    expect(m.chainPort.checkout).not.toHaveBeenCalled();
    expect(result.created_orders).toEqual([]);
    expect(result.failed_lines).toHaveLength(2);
  });

  // До 25.09.2026 непрошедшая позиция приходила только текстом: клиент не мог
  // отличить «кончился остаток» от «сняли с продажи», не разбирая фразу.
  it('непрошедшая позиция несёт код причины: код отказа подготовки, общий код для прочего сбоя, свой код для снятого предложения', async () => {
    const m = build(withoutStatement);
    m.orderCreateService.prepare.mockRejectedValue(
      DomainError.badRequest('MARKETPLACE_ORDER_QUANTITY_UNAVAILABLE', { available: 0, unitLabel: 'шт', requested: 2 })
    );
    m.stockService.prepareStockOrder.mockRejectedValue(new Error('сбой базы'));

    const result = await m.service.execute(scope, {});

    expect(result.failed_lines.map((f) => [f.offer_id, f.code])).toEqual([
      ['offer-a', 'MARKETPLACE_ORDER_QUANTITY_UNAVAILABLE'],
      ['offer-b', 'MARKETPLACE_CHECKOUT_ITEM_FAILED'],
    ]);
    expect(result.failed_lines[1].reason).toBe('сбой базы');

    const withdrawn = build(withoutStatement);
    withdrawn.offerRepo.findByIds.mockResolvedValue([
      { ...supplierOffer, status: MarketplaceOfferStatuses.WITHDRAWN },
      stockOffer,
    ]);
    const second = await withdrawn.service.execute(scope, {});
    expect(second.failed_lines).toEqual([
      expect.objectContaining({ offer_id: 'offer-a', code: 'MARKETPLACE_CHECKOUT_OFFER_NOT_ACTIVE' }),
    ]);
  });
});
