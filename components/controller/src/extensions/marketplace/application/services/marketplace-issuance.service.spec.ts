import { ConflictException } from '@nestjs/common';
import { MarketplaceIssuanceService } from './marketplace-issuance.service';
import { MARKETPLACE_ORDER_READY_TO_RECEIVE_EVENT } from '../events/marketplace-notification.events';
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
    ready_announced_at: null,
    chairman_signed_at: null,
    warranty_period_secs: 0,
    ...overrides,
  } as MarketplaceOrderDomainEntity;
}

function buildMocks(warehouseByOrder: Record<string, number>) {
  const orderRepo = {
    findById: jest.fn().mockImplementation(async (id: string) => buildOrder({ id })),
    applyIssuanceOpened: jest.fn(),
    applyReadyAnnounced: jest
      .fn()
      .mockImplementation(async (id: string) => buildOrder({ id, ready_announced_at: new Date() })),
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

  describe('announceReady', () => {
    it('объявляет готовность и шлёт push заказчику (ACCEPTED_TO_COOP, склад > 0)', async () => {
      const mocks = buildMocks({ 'order-1': 5 });
      const service = buildService(mocks);
      const res = await service.announceReady({
        coopname: 'voskhod',
        order_id: 'order-1',
        operator_account: 'operator1',
      });
      expect(mocks.orderRepo.applyReadyAnnounced).toHaveBeenCalledWith('order-1');
      expect(res.ready_announced_at).not.toBeNull();
      expect(mocks.eventBus.emit).toHaveBeenCalledWith(
        MARKETPLACE_ORDER_READY_TO_RECEIVE_EVENT,
        expect.objectContaining({ order_id: 'order-1', orderer_account: 'orderer1' })
      );
    });

    it('идемпотентно: уже объявлено — без повторного push и записи', async () => {
      const mocks = buildMocks({ 'order-1': 5 });
      mocks.orderRepo.findById = jest
        .fn()
        .mockResolvedValue(buildOrder({ id: 'order-1', ready_announced_at: new Date() }));
      const service = buildService(mocks);
      await service.announceReady({
        coopname: 'voskhod',
        order_id: 'order-1',
        operator_account: 'operator1',
      });
      expect(mocks.orderRepo.applyReadyAnnounced).not.toHaveBeenCalled();
      expect(mocks.eventBus.emit).not.toHaveBeenCalled();
    });

    it('нельзя объявить, пока на склад по заказу ничего не принято', async () => {
      const mocks = buildMocks({ 'order-1': 0 });
      const service = buildService(mocks);
      await expect(
        service.announceReady({ coopname: 'voskhod', order_id: 'order-1', operator_account: 'operator1' })
      ).rejects.toThrow(ConflictException);
      expect(mocks.eventBus.emit).not.toHaveBeenCalled();
    });

    it('нельзя объявить заказ не в статусе ACCEPTED_TO_COOP', async () => {
      const mocks = buildMocks({ 'order-1': 5 });
      mocks.orderRepo.findById = jest
        .fn()
        .mockResolvedValue(buildOrder({ id: 'order-1', status: 'ACTIVE' }));
      const service = buildService(mocks);
      await expect(
        service.announceReady({ coopname: 'voskhod', order_id: 'order-1', operator_account: 'operator1' })
      ).rejects.toThrow(ConflictException);
    });

    it('нельзя объявить, если выдача уже открыта (chairman_signed_at задан)', async () => {
      const mocks = buildMocks({ 'order-1': 5 });
      mocks.orderRepo.findById = jest
        .fn()
        .mockResolvedValue(buildOrder({ id: 'order-1', chairman_signed_at: new Date() }));
      const service = buildService(mocks);
      await expect(
        service.announceReady({ coopname: 'voskhod', order_id: 'order-1', operator_account: 'operator1' })
      ).rejects.toThrow(ConflictException);
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

    it('оффер с фасовкой (order_unit_size=0.1, kg) → акт в единицах заказа без пересчёта: кол-во=5, цена за фасовку, единица «100 г»', async () => {
      const mocks = buildMocks({ 'order-1': 5 });
      mocks.offerRepo.findById.mockResolvedValue({
        id: 'offer-1',
        product_name: 'Икра',
        unit_of_measure: 'kg',
        order_unit_size: '0.1',
      } as unknown as Awaited<ReturnType<MarketplaceOfferDomainRepository['findById']>>);
      const service = buildService(mocks);
      await service.getOpenIssuanceSignablePayload('voskhod', 'order-1', 'chairman');
      const action = mocks.documentDomainService.generateDocument.mock.calls[0][0].data;
      // 5 единиц заказа (порций по 100 г) — так и остаются 5, цена за порцию (100),
      // без разворота в 0.5 кг; единица измерения = ярлык фасовки «100 г».
      expect(action.fact_quantity).toBe(5);
      expect(action.unit_cost).toBe('100.0000');
      expect(action.total_amount).toBe('500.0000');
      expect(action.unit_of_measurement).toBe('100 г');
    });

    it('не формирует акт, когда на складе пусто', async () => {
      const service = buildService(buildMocks({ 'order-1': 0 }));
      await expect(
        service.getOpenIssuanceSignablePayload('voskhod', 'order-1', 'chairman')
      ).rejects.toThrow(ConflictException);
    });
  });
});
