import { BadRequestException } from '@nestjs/common';
import { MarketplaceStockService } from './marketplace-stock.service';
import { MarketplaceInventoryDomainEntity } from '../../domain/entities/marketplace-inventory.entity';
import { MarketplaceInventoryOwnerships } from '../../domain/entities/marketplace-inventory.types';
import {
  MarketplaceOfferStatuses,
  MarketplaceSaleForms,
  MarketplaceUnitsOfMeasure,
} from '../../domain/entities/marketplace-offer.types';
import type { MarketplaceOfferDomainEntity } from '../../domain/entities/marketplace-offer.entity';
import type { MarketplaceAssetConfig } from './marketplace-asset.config';

/**
 * Публикация остатка склада в каталог: цена прибытия задана за единицу
 * отпуска (за упаковку при упаковочной приёмке), а витрина ведёт
 * `price_per_unit` за базовую единицу. Здесь проверяется, что размерности не
 * путаются — иначе цена остатка и цены упаковок улетают кратно фасовке.
 */
function buildPosition(over: Partial<Record<string, unknown>> = {}): MarketplaceInventoryDomainEntity {
  return new MarketplaceInventoryDomainEntity({
    id: 'inv-1',
    coopname: 'voskhod',
    barcode_value: null,
    barcode_format: null,
    order_id: 'order-1',
    shipment_id: 'ship-1',
    braname: 'voskhod1',
    status: 'RECEIVED',
    product_name_snapshot: 'Яйцо куриное',
    quantity_per_label: 20,
    orderer_account_snapshot: 'member1',
    shelf: null,
    cell_id: null,
    container_id: null,
    received_at: new Date('2026-08-12T10:00:00Z'),
    received_by_operator_account: 'operator1',
    labeled_at: null,
    labeled_by_operator_account: null,
    expiry_date: null,
    ownership: MarketplaceInventoryOwnerships.COOP,
    arrival_price: '150.0000',
    package_size: 10,
    unit_of_measure: MarketplaceUnitsOfMeasure.PIECE,
    published_offer_id: null,
    reserved_order_id: null,
    created_at: new Date('2026-08-12T10:00:00Z'),
    updated_at: new Date('2026-08-12T10:00:00Z'),
    ...(over as any),
  });
}

function buildOriginOffer(): MarketplaceOfferDomainEntity {
  return {
    id: 'offer-origin',
    coopname: 'voskhod',
    supplier_account: 'supplier1',
    vitrine_id: 'default',
    product_name: 'Яйцо куриное',
    description: '',
    category_id: 1,
    // Витринная цена origin — за базовую единицу (штуку); упаковка стоит 150 ₽.
    price_per_unit: '15.0000',
    unit_of_measure: MarketplaceUnitsOfMeasure.PIECE,
    sale_form: MarketplaceSaleForms.PACKAGED,
    packages: [
      {
        id: 'pkg-10',
        size: 10,
        price: '150.0000',
        label: 'Десяток',
        package_type: 'картонная коробка',
        sort_order: 1,
        is_default: true,
      },
    ],
    quantity_available: 0,
    unlimited_flag: false,
    shelf_life_days: 10,
    warranty_days: 3,
    barcode_strategy: 'PER_ORDER',
    pack_size: null,
    images: [],
    status: MarketplaceOfferStatuses.ACTIVE,
    stock_braname: null,
    stock_origin_offer_id: null,
  } as unknown as MarketplaceOfferDomainEntity;
}

function buildMocks() {
  const origin = buildOriginOffer();
  const inventoryRepo = {
    findById: jest.fn().mockResolvedValue(buildPosition()),
    list: jest.fn().mockResolvedValue([]),
    setPublication: jest.fn().mockResolvedValue(undefined),
  } as any;
  const offerRepo = {
    findByIds: jest.fn().mockResolvedValue([origin]),
    list: jest.fn().mockResolvedValue({ items: [], totalCount: 0, totalPages: 0, currentPage: 1 }),
    create: jest.fn().mockImplementation(async (input: Record<string, unknown>) => ({
      ...origin,
      ...input,
      id: 'offer-coop',
    })),
    applyUpdate: jest.fn(),
  } as any;
  const orderRepo = {
    findById: jest.fn().mockResolvedValue({ id: 'order-1', offer_id: 'offer-origin' }),
  } as any;
  const offerCounters = {} as any;
  const chainPort = {} as any;
  const assetConfig: MarketplaceAssetConfig = { symbol: 'RUB', decimals: 4 };
  const eventBus = { emit: jest.fn() } as any;
  const logger = {
    setContext: jest.fn(),
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  } as any;
  return { inventoryRepo, offerRepo, orderRepo, offerCounters, chainPort, assetConfig, eventBus, logger, origin };
}

function buildService(mocks: ReturnType<typeof buildMocks>): MarketplaceStockService {
  return new MarketplaceStockService(
    mocks.inventoryRepo,
    mocks.offerRepo,
    mocks.orderRepo,
    mocks.offerCounters,
    mocks.chainPort,
    mocks.assetConfig,
    mocks.eventBus,
    mocks.logger
  );
}

describe('MarketplaceStockService.publishStock — размерность цены остатка', () => {
  let mocks: ReturnType<typeof buildMocks>;
  let service: MarketplaceStockService;

  beforeEach(() => {
    mocks = buildMocks();
    service = buildService(mocks);
  });

  it('без явной цены публикует по цене прибытия, приведённой к базовой единице', async () => {
    await service.publishStock({
      coopname: 'voskhod',
      operator_account: 'operator1',
      inventory_ids: ['inv-1'],
    });

    const created = mocks.offerRepo.create.mock.calls[0][0];
    // 150 ₽ за десяток → 15 ₽ за штуку на витрине; цена упаковки не меняется.
    expect(created.price_per_unit).toBe('15.0000');
    expect(created.packages[0].price).toBe('150.0000');
  });

  it('уценка ниже цены прибытия проходит и масштабирует цену упаковки', async () => {
    await service.publishStock({
      coopname: 'voskhod',
      operator_account: 'operator1',
      inventory_ids: ['inv-1'],
      price_per_unit: '12.0000',
    });

    const created = mocks.offerRepo.create.mock.calls[0][0];
    expect(created.price_per_unit).toBe('12.0000');
    expect(created.packages[0].price).toBe('120.0000');
  });

  it('цена выше цены прибытия отвергается — сравнение идёт за упаковку', async () => {
    // 20 ₽ за штуку — это 200 ₽ за десяток при цене прибытия 150 ₽.
    await expect(
      service.publishStock({
        coopname: 'voskhod',
        operator_account: 'operator1',
        inventory_ids: ['inv-1'],
        price_per_unit: '20.0000',
      })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('отпуск по мере сравнивает цену напрямую, без фасовки', async () => {
    mocks.inventoryRepo.findById.mockResolvedValue(
      buildPosition({
        package_size: 0,
        arrival_price: '80.0000',
        unit_of_measure: MarketplaceUnitsOfMeasure.KG,
      })
    );

    await expect(
      service.publishStock({
        coopname: 'voskhod',
        operator_account: 'operator1',
        inventory_ids: ['inv-1'],
        price_per_unit: '90.0000',
      })
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
