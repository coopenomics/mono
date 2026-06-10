import { ConflictException } from '@nestjs/common';
import { MarketplaceIssuanceService } from './marketplace-issuance.service';
import type { MarketplaceOrderDomainEntity } from '../../domain/entities/marketplace-order.entity';
import type { MarketplaceOrderDomainRepository } from '../../domain/repositories/marketplace-order.repository';
import type { MarketplaceInventoryDomainRepository } from '../../domain/repositories/marketplace-inventory.repository';
import type { MarketplaceOfferDomainRepository } from '../../domain/repositories/marketplace-offer.repository';
import type { MarketplaceCanonicalBlockchainPort } from '../../domain/ports/marketplace-canonical-blockchain.port';
import type { MarketplaceAssetConfig } from './marketplace-asset.config';

function buildOrder(
  overrides: Partial<MarketplaceOrderDomainEntity> = {}
): MarketplaceOrderDomainEntity {
  return {
    id: 'order-1',
    coopname: 'voskhod',
    order_hash: 'h-order-1',
    orderer_account: 'orderer1',
    offer_id: 'offer-1',
    supplier_account: 'supplier1',
    delivery_braname: 'kubra',
    quantity: 10,
    price_per_unit: '100.0000',
    total_cost: '1000.0000',
    status: 'ACCEPTED_TO_COOP',
    chairman_signed_at: null,
    warranty_period_secs: 0,
    ...overrides,
  } as MarketplaceOrderDomainEntity;
}

function buildMocks(warehouseByOrder: Record<string, number>) {
  const orderRepo = {
    findById: jest.fn().mockImplementation(async (id: string) => buildOrder({ id })),
    applyIssuanceOpened: jest.fn(),
  } as unknown as jest.Mocked<MarketplaceOrderDomainRepository>;

  const inventoryRepo = {
    sumOnWarehouseByOrders: jest
      .fn()
      .mockImplementation(async (_coopname: string, ids: string[]) => {
        const map = new Map<string, number>();
        for (const id of ids) {
          if (warehouseByOrder[id] !== undefined) map.set(id, warehouseByOrder[id]);
        }
        return map;
      }),
  } as unknown as jest.Mocked<MarketplaceInventoryDomainRepository>;

  const offerRepo = {
    findById: jest.fn().mockResolvedValue(null),
  } as unknown as jest.Mocked<MarketplaceOfferDomainRepository>;

  const chainPort = {
    signIss1: jest.fn(),
    signIss2: jest.fn(),
  } as unknown as jest.Mocked<MarketplaceCanonicalBlockchainPort>;

  const assetConfig: MarketplaceAssetConfig = { symbol: 'RUB', decimals: 4 };

  const documentDomainService = {
    generateDocument: jest.fn().mockImplementation(async ({ data }: any) => ({
      full_title: 'АПП выдачи',
      html: '<html/>',
      hash: 'doc-hash',
      meta: data,
      binary: '',
    })),
    buildDocumentAggregate: jest.fn(),
  } as any;

  const eventBus = { emit: jest.fn() } as any;

  const logger = {
    setContext: jest.fn(),
    debug: jest.fn(),
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  } as any;

  return { orderRepo, inventoryRepo, offerRepo, chainPort, assetConfig, documentDomainService, eventBus, logger };
}

function buildService(mocks: ReturnType<typeof buildMocks>): MarketplaceIssuanceService {
  return new MarketplaceIssuanceService(
    mocks.orderRepo,
    mocks.inventoryRepo,
    mocks.offerRepo,
    mocks.chainPort,
    mocks.assetConfig,
    mocks.documentDomainService,
    mocks.eventBus,
    mocks.logger
  );
}

const signedDocumentStub = { signatures: [] } as any;

describe('MarketplaceIssuanceService — гард склада на выдаче', () => {
  // Инвариант (инцидент 2026-06-09): выдать со склада можно не больше, чем
  // фактически принято по заказу (Σ RECEIVED/LABELED). Заказ 10, принято 5 —
  // акт на 10 не должен ни формироваться, ни подписываться.

  describe('openIssuance', () => {
    it('отклоняет выдачу больше принятого на склад', async () => {
      const service = buildService(buildMocks({ 'order-1': 5 }));
      await expect(
        service.openIssuance({
          coopname: 'voskhod',
          chairman_account: 'chairman',
          order_id: 'order-1',
          actual_quantity: 10,
          actual_unit_price: '100.0000',
          signed_document: signedDocumentStub,
        })
      ).rejects.toThrow(ConflictException);
    });

    it('отклоняет выдачу, когда на складе по заказу ничего нет', async () => {
      const service = buildService(buildMocks({}));
      await expect(
        service.openIssuance({
          coopname: 'voskhod',
          chairman_account: 'chairman',
          order_id: 'order-1',
          actual_quantity: 1,
          actual_unit_price: '100.0000',
          signed_document: signedDocumentStub,
        })
      ).rejects.toThrow(ConflictException);
    });

    it('пропускает выдачу в пределах принятого до проверки подписи', async () => {
      const service = buildService(buildMocks({ 'order-1': 5 }));
      // Гард склада пройден (5 ≤ 5) — падение дальше, на верификации пустых
      // подписей, и это НЕ ConflictException гарда.
      await expect(
        service.openIssuance({
          coopname: 'voskhod',
          chairman_account: 'chairman',
          order_id: 'order-1',
          actual_quantity: 5,
          actual_unit_price: '100.0000',
          signed_document: signedDocumentStub,
        })
      ).rejects.toThrow('Документ не подписан');
    });
  });

  describe('getOpenIssuanceSignablePayload', () => {
    it('не формирует акт на количество больше принятого', async () => {
      const service = buildService(buildMocks({ 'order-1': 5 }));
      await expect(
        service.getOpenIssuanceSignablePayload('voskhod', 'order-1', 'chairman', 10, '100.0000')
      ).rejects.toThrow(ConflictException);
    });

    it('по умолчанию формирует акт на min(заказано, принято)', async () => {
      const mocks = buildMocks({ 'order-1': 5 });
      const service = buildService(mocks);
      await service.getOpenIssuanceSignablePayload('voskhod', 'order-1', 'chairman');
      const action = mocks.documentDomainService.generateDocument.mock.calls[0][0].data;
      expect(action.fact_quantity).toBe(5);
      expect(action.total_amount).toBe('500.0000');
    });

    it('не формирует акт, когда на складе пусто', async () => {
      const service = buildService(buildMocks({ 'order-1': 0 }));
      await expect(
        service.getOpenIssuanceSignablePayload('voskhod', 'order-1', 'chairman')
      ).rejects.toThrow(ConflictException);
    });
  });
});
