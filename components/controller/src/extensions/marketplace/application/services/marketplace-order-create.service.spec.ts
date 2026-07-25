import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { MarketplaceOrderCreateService } from './marketplace-order-create.service';
import type { MarketplaceOrderDomainEntity } from '../../domain/entities/marketplace-order.entity';
import type { MarketplaceOfferDomainEntity } from '../../domain/entities/marketplace-offer.entity';
import type { MarketplaceOfferDomainRepository } from '../../domain/repositories/marketplace-offer.repository';
import type { MarketplaceOrderDomainRepository } from '../../domain/repositories/marketplace-order.repository';
import type { MarketplaceOfferCountersService } from './marketplace-offer-counters.service';
import type { MarketplaceCanonicalBlockchainPort } from '../../domain/ports/marketplace-canonical-blockchain.port';
import type { MarketContract } from 'cooptypes';

// Подписанное заявление о конвертации (обязательный параметр createorder);
// подпись верифицирует контракт, сервис передаёт документ как есть.
const CONVERT_STATEMENT = {
  version: '1.0.0',
  hash: 'a'.repeat(64),
  doc_hash: 'b'.repeat(64),
  meta_hash: 'c'.repeat(64),
  meta: '{}',
  signatures: [],
} as unknown as MarketContract.Actions.CreateOrder.ICreateOrder['convert_statement'];
import {
  MarketplaceOfferStatuses,
  MarketplaceSaleForms,
  MarketplaceUnitsOfMeasure,
} from '../../domain/entities/marketplace-offer.types';

function buildOffer(overrides: Partial<MarketplaceOfferDomainEntity> = {}): MarketplaceOfferDomainEntity {
  return {
    id: 'offer-1',
    coopname: 'voskhod',
    supplier_account: 'supplier1',
    vitrine_id: 'default',
    product_name: 'Тестовый товар',
    description: null,
    category_id: 1,
    price_per_unit: '150.0000',
    unit_of_measure: MarketplaceUnitsOfMeasure.PIECE,
    order_unit_size: '1',
    quantity_available: 10,
    quantity_blocked: 0,
    quantity_consumed: 0,
    unlimited_flag: false,
    delivery_points: [{ braname: 'krasnogorsk', min_supply_volume: 1 }],
    warranty_days: 7,
    status: MarketplaceOfferStatuses.ACTIVE,
    approved_by: 'chairman',
    approved_at: new Date(),
    rejected_by: null,
    rejected_at: null,
    reject_reason: null,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  } as MarketplaceOfferDomainEntity;
}

function buildMocks() {
  const offerRepo: jest.Mocked<MarketplaceOfferDomainRepository> = {
    findById: jest.fn(),
  } as unknown as jest.Mocked<MarketplaceOfferDomainRepository>;

  const orderRepo: jest.Mocked<MarketplaceOrderDomainRepository> = {
    persistAfterBlock: jest.fn(),
  } as unknown as jest.Mocked<MarketplaceOrderDomainRepository>;

  const counters: jest.Mocked<MarketplaceOfferCountersService> = {
    onOrderBlocked: jest.fn(),
    onOrderRolledBack: jest.fn(),
  } as unknown as jest.Mocked<MarketplaceOfferCountersService>;

  const chainPort: jest.Mocked<MarketplaceCanonicalBlockchainPort> = {
    createOrder: jest.fn(),
  } as unknown as jest.Mocked<MarketplaceCanonicalBlockchainPort>;

  const logger = {
    setContext: jest.fn(),
    debug: jest.fn(),
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
  } as any;

  return { offerRepo, orderRepo, counters, chainPort, logger };
}

describe('MarketplaceOrderCreateService', () => {
  let mocks: ReturnType<typeof buildMocks>;
  let service: MarketplaceOrderCreateService;

  beforeEach(() => {
    mocks = buildMocks();
    service = new MarketplaceOrderCreateService(
      mocks.offerRepo,
      mocks.orderRepo,
      mocks.counters,
      mocks.chainPort,
      { symbol: 'RUB', decimals: 4 },
      { emit: jest.fn() } as any,
      mocks.logger
    );
  });

  it('Guard FR11a: бросает NotFoundException если Offer не найден', async () => {
    mocks.offerRepo.findById.mockResolvedValue(null);
    await expect(
      service.execute({
        coopname: 'voskhod',
        orderer_account: 'orderer1',
        offer_id: 'no-such-offer',
        quantity: 1,
        delivery_braname: 'ku.krasn.1',
        convert_statement: CONVERT_STATEMENT,
      })
    ).rejects.toThrow(NotFoundException);
    expect(mocks.counters.onOrderBlocked).not.toHaveBeenCalled();
    expect(mocks.chainPort.createOrder).not.toHaveBeenCalled();
  });

  it('Guard FR11a: бросает Forbidden при попытке Order по Offer другого кооператива', async () => {
    mocks.offerRepo.findById.mockResolvedValue(buildOffer({ coopname: 'other-coop' }));
    await expect(
      service.execute({
        coopname: 'voskhod',
        orderer_account: 'orderer1',
        offer_id: 'offer-1',
        quantity: 1,
        delivery_braname: 'ku.krasn.1',
        convert_statement: CONVERT_STATEMENT,
      })
    ).rejects.toThrow(ForbiddenException);
  });

  it('Guard FR11a: бросает BadRequest при неактивном Offer (PENDING_MODERATION)', async () => {
    mocks.offerRepo.findById.mockResolvedValue(buildOffer({ status: MarketplaceOfferStatuses.PENDING_MODERATION }));
    await expect(
      service.execute({
        coopname: 'voskhod',
        orderer_account: 'orderer1',
        offer_id: 'offer-1',
        quantity: 1,
        delivery_braname: 'ku.krasn.1',
        convert_statement: CONVERT_STATEMENT,
      })
    ).rejects.toThrow(BadRequestException);
  });

  it('Guard FR11a: бросает BadRequest при quantity > Offer.quantity_available (non-unlimited)', async () => {
    mocks.offerRepo.findById.mockResolvedValue(buildOffer({ quantity_available: 2 }));
    await expect(
      service.execute({
        coopname: 'voskhod',
        orderer_account: 'orderer1',
        offer_id: 'offer-1',
        quantity: 5,
        delivery_braname: 'ku.krasn.1',
        convert_statement: CONVERT_STATEMENT,
      })
    ).rejects.toThrow(/Доступно только 2 ед./);
  });

  it('Guard: бросает BadRequest при quantity <= 0', async () => {
    await expect(
      service.execute({
        coopname: 'voskhod',
        orderer_account: 'orderer1',
        offer_id: 'offer-1',
        quantity: 0,
        delivery_braname: 'ku.krasn.1',
        convert_statement: CONVERT_STATEMENT,
      })
    ).rejects.toThrow(/Количество должно быть больше нуля/);
  });

  it('compensating rollback: при chain submit fail вызывает counters.onOrderRolledBack', async () => {
    mocks.offerRepo.findById.mockResolvedValue(buildOffer());
    mocks.counters.onOrderBlocked.mockResolvedValue({
      id: 'offer-1',
      quantity_available: 7,
      quantity_blocked: 3,
      quantity_consumed: 0,
    } as any);
    mocks.chainPort.createOrder.mockRejectedValue(
      new Error('assertion failure with message: Недостаточно средств для блокировки\n')
    );

    await expect(
      service.execute({
        coopname: 'voskhod',
        orderer_account: 'orderer1',
        offer_id: 'offer-1',
        quantity: 3,
        delivery_braname: 'ku.krasn.1',
        convert_statement: CONVERT_STATEMENT,
      })
    ).rejects.toThrow(/Недостаточно средств/);

    expect(mocks.counters.onOrderBlocked).toHaveBeenCalledWith('offer-1', 3);
    expect(mocks.counters.onOrderRolledBack).toHaveBeenCalledWith('offer-1', 3);
    expect(mocks.orderRepo.persistAfterBlock).not.toHaveBeenCalled();
  });

  it('happy path: создаёт Order через optimistic block → chain → persist', async () => {
    mocks.offerRepo.findById.mockResolvedValue(buildOffer({ quantity_available: 10 }));
    mocks.counters.onOrderBlocked.mockResolvedValue({
      id: 'offer-1',
      quantity_available: 8,
      quantity_blocked: 2,
      quantity_consumed: 0,
    } as any);
    // Форма wharfkit @1.6.x: nodeos-ответ в `response` (см. normalizeTxResult).
    mocks.chainPort.createOrder.mockResolvedValue({
      response: {
        transaction_id: 'tx-hash-xyz',
        processed: { id: 'tx-hash-xyz', block_num: 9_999_999 },
      },
    } as any);
    mocks.orderRepo.persistAfterBlock.mockImplementation(async (input) =>
      ({
        ...input,
        id: 'order-uuid-new',
        created_at: new Date(),
        updated_at: new Date(),
      } as unknown as MarketplaceOrderDomainEntity)
    );

    const result = await service.execute({
      coopname: 'voskhod',
      orderer_account: 'orderer1',
      offer_id: 'offer-1',
      quantity: 2,
      delivery_braname: 'ku.krasn.1',
      convert_statement: CONVERT_STATEMENT,
    });

    expect(mocks.counters.onOrderBlocked).toHaveBeenCalledWith('offer-1', 2);
    expect(mocks.chainPort.createOrder).toHaveBeenCalledTimes(1);
    expect(mocks.counters.onOrderRolledBack).not.toHaveBeenCalled();
    expect(mocks.orderRepo.persistAfterBlock).toHaveBeenCalledTimes(1);

    expect(result.tx_snapshot.tx_hash).toBe('tx-hash-xyz');
    expect(result.tx_snapshot.block_num).toBe(9_999_999);
    expect(result.tx_snapshot.locked_amount).toBe('300.0000'); // 2 × 150
    expect(result.order.id).toBe('order-uuid-new');

    const chainArgs = mocks.chainPort.createOrder.mock.calls[0][0];
    expect(chainArgs.coopname).toBe('voskhod');
    expect(chainArgs.orderer).toBe('orderer1');
    expect(chainArgs.offerer).toBe('supplier1');
    expect(chainArgs.delivery_braname).toBe('ku.krasn.1');
    expect(chainArgs.quantity).toBe('2 PCS');
    expect(chainArgs.unit_price).toBe('150.0000 RUB');
    expect(chainArgs.package_size).toBe('0 PCS'); // по мере — упаковки нет
    expect(chainArgs.warranty_period_secs).toBe(7 * 86_400);
    expect(chainArgs.order_hash).toHaveLength(64);
    expect(chainArgs.offer_hash).toHaveLength(64);
    expect(chainArgs.batch_hash).toBe('0'.repeat(64));
  });

  /**
   * Инцидент 2026-07-25: заказ 10 упаковок по 0,1 л при цене 100 ₽/упаковку
   * заблокировал на кошельке 100 ₽ вместо 1000 ₽. Причиной оказался не этот
   * сервис (устаревший контракт на dev-цепи), но именно здесь собираются
   * параметры транзакции createorder — если бы сервис когда-нибудь начал
   * считать total_cost/quantity по базовому количеству вместо числа упаковок,
   * этот тест обязан упасть первым.
   */
  it('happy path (упаковкой, Эпик 18): total_cost = число упаковок × цена упаковки, НЕ базовое количество × цена', async () => {
    mocks.offerRepo.findById.mockResolvedValue(
      buildOffer({
        sale_form: MarketplaceSaleForms.PACKAGED,
        unit_of_measure: MarketplaceUnitsOfMeasure.LITER,
        packages: [
          { id: 'pkg-0.1l', size: 0.1, price: '100.0000', label: null, sort_order: 0, is_default: true },
        ],
        quantity_available: 10,
      })
    );
    mocks.counters.onOrderBlocked.mockResolvedValue({
      id: 'offer-1',
      quantity_available: 9,
      quantity_blocked: 1,
      quantity_consumed: 0,
    } as any);
    mocks.chainPort.createOrder.mockResolvedValue({
      response: {
        transaction_id: 'tx-hash-pkg',
        processed: { id: 'tx-hash-pkg', block_num: 9_999_998 },
      },
    } as any);
    mocks.orderRepo.persistAfterBlock.mockImplementation(async (input) =>
      ({
        ...input,
        id: 'order-uuid-pkg',
        created_at: new Date(),
        updated_at: new Date(),
      } as unknown as MarketplaceOrderDomainEntity)
    );

    const result = await service.execute({
      coopname: 'voskhod',
      orderer_account: 'orderer1',
      offer_id: 'offer-1',
      quantity: 10, // 10 упаковок, не 10 литров
      package_id: 'pkg-0.1l',
      delivery_braname: 'ku.krasn.1',
      convert_statement: CONVERT_STATEMENT,
    });

    // Именно тот баг, который списал 100 ₽ вместо 1000 ₽ на реальном заказе:
    // 1 л (базовое количество) × 100 ₽ = 100 ₽. Ожидаемое — 10 упаковок × 100 ₽.
    expect(result.tx_snapshot.locked_amount).toBe('1000.0000');
    expect(result.tx_snapshot.locked_amount).not.toBe('100.0000');

    const chainArgs = mocks.chainPort.createOrder.mock.calls[0][0];
    // На цепь уходит БАЗОВОЕ количество (1 л = 10 упаковок × 0,1 л) — контракт
    // сам восстанавливает число упаковок делением на package_size.
    expect(chainArgs.quantity).toBe('1.000 LTR');
    expect(chainArgs.unit_price).toBe('100.0000 RUB'); // цена за упаковку, не за литр
    expect(chainArgs.package_size).toBe('0.100 LTR');

    // Блокировка остатка оффера — тоже в базовом количестве (1 л), не в числе упаковок.
    expect(mocks.counters.onOrderBlocked).toHaveBeenCalledWith('offer-1', 1);
    expect(result.order.id).toBe('order-uuid-pkg');
  });
});
