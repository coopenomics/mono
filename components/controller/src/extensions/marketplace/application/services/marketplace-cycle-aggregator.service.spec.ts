import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { MarketplaceCycleAggregatorService } from './marketplace-cycle-aggregator.service';
import type { MarketplaceOfferDomainEntity } from '../../domain/entities/marketplace-offer.entity';
import type { MarketplaceOrderDomainEntity } from '../../domain/entities/marketplace-order.entity';
import type { MarketplaceOfferDomainRepository } from '../../domain/repositories/marketplace-offer.repository';
import type { MarketplaceOrderDomainRepository } from '../../domain/repositories/marketplace-order.repository';
import type { MarketplaceConsolidatedRequestDomainRepository } from '../../domain/repositories/marketplace-consolidated-request.repository';
import type { MarketplaceCanonicalBlockchainPort } from '../../domain/ports/marketplace-canonical-blockchain.port';
import type { MarketplaceOfferCountersService } from './marketplace-offer-counters.service';

function buildOffer(overrides: Partial<MarketplaceOfferDomainEntity> = {}): MarketplaceOfferDomainEntity {
  return {
    id: 'offer-c',
    coopname: 'voskhod',
    supplier_account: 'supplier1',
    price_per_unit: '100.0000',
    cycle_type: 'collective',
    target_volume: null,
    status: 'ACTIVE',
    unlimited_flag: false,
    quantity_available: 100,
    quantity_blocked: 0,
    quantity_consumed: 0,
    ...overrides,
  } as MarketplaceOfferDomainEntity;
}

function buildOrder(overrides: Partial<MarketplaceOrderDomainEntity> = {}): MarketplaceOrderDomainEntity {
  return {
    id: `order-${Math.random().toString(36).slice(2, 9)}`,
    quantity: 5,
    coopname: 'voskhod',
    offer_id: 'offer-c',
    order_hash: `hash-${Math.random().toString(36).slice(2, 9)}`,
    status: 'ACTIVE',
    cycle_id: null,
    blocked_at: new Date('2026-05-01T10:00:00Z'),
    created_at: new Date('2026-05-01T10:00:00Z'),
    ...overrides,
  } as MarketplaceOrderDomainEntity;
}

function buildMocks() {
  const offerRepo: jest.Mocked<MarketplaceOfferDomainRepository> = {
    findById: jest.fn(),
  } as unknown as jest.Mocked<MarketplaceOfferDomainRepository>;

  const orderRepo: jest.Mocked<MarketplaceOrderDomainRepository> = {
    findUnassignedActiveByOffer: jest.fn(),
    sumUnassignedActiveByOffer: jest.fn(),
    assignToCycle: jest.fn(),
    findByCycleId: jest.fn(),
    applyStatusTransition: jest.fn(),
  } as unknown as jest.Mocked<MarketplaceOrderDomainRepository>;

  const cycleRepo: jest.Mocked<MarketplaceConsolidatedRequestDomainRepository> = {
    create: jest.fn(),
    applyStatusTransition: jest.fn(),
    findExpiredAwaitingResponse: jest.fn(),
  } as unknown as jest.Mocked<MarketplaceConsolidatedRequestDomainRepository>;

  const chainPort: jest.Mocked<MarketplaceCanonicalBlockchainPort> = {
    createOrder: jest.fn(),
    expireOrder: jest.fn().mockResolvedValue({} as any),
    acceptOrder: jest.fn().mockResolvedValue({} as any),
  } as unknown as jest.Mocked<MarketplaceCanonicalBlockchainPort>;

  const offerCounters: jest.Mocked<MarketplaceOfferCountersService> = {
    onOrderBlocked: jest.fn(),
    onOrderUnblocked: jest.fn().mockResolvedValue({} as any),
    onOrderConsumed: jest.fn(),
    onOrderRolledBack: jest.fn(),
    onOrderAdjusted: jest.fn(),
  } as unknown as jest.Mocked<MarketplaceOfferCountersService>;

  const logger = {
    setContext: jest.fn(),
    debug: jest.fn(),
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  } as any;

  return { offerRepo, orderRepo, cycleRepo, chainPort, offerCounters, logger };
}

describe('MarketplaceCycleAggregatorService', () => {
  let mocks: ReturnType<typeof buildMocks>;
  let service: MarketplaceCycleAggregatorService;

  beforeEach(() => {
    mocks = buildMocks();
    service = new MarketplaceCycleAggregatorService(
      mocks.offerRepo,
      mocks.orderRepo,
      mocks.cycleRepo,
      mocks.chainPort,
      mocks.offerCounters,
      mocks.logger
    );
  });

  describe('evaluateCollectiveAfterCreate', () => {
    it('возвращает null если целевой объём не задан (manual-only collective)', async () => {
      const result = await service.evaluateCollectiveAfterCreate(
        'voskhod',
        'offer-c',
        'supplier1',
        null,
        '100.0000'
      );

      expect(result).toBeNull();
      expect(mocks.orderRepo.sumUnassignedActiveByOffer).not.toHaveBeenCalled();
      expect(mocks.cycleRepo.create).not.toHaveBeenCalled();
    });

    it('возвращает null если sum < target_volume', async () => {
      mocks.orderRepo.sumUnassignedActiveByOffer.mockResolvedValue(7);

      const result = await service.evaluateCollectiveAfterCreate(
        'voskhod',
        'offer-c',
        'supplier1',
        10,
        '100.0000'
      );

      expect(result).toBeNull();
      expect(mocks.cycleRepo.create).not.toHaveBeenCalled();
    });

    it('создаёт PENDING_SUPPLIER_ACCEPT и assignToCycle когда sum >= target_volume', async () => {
      mocks.orderRepo.sumUnassignedActiveByOffer.mockResolvedValue(12);
      mocks.orderRepo.findUnassignedActiveByOffer.mockResolvedValue([
        buildOrder({ id: 'o1', offer_id: 'offer-c', quantity: 7 }),
        buildOrder({ id: 'o2', offer_id: 'offer-c', quantity: 5 }),
      ]);
      mocks.cycleRepo.create.mockImplementation(async (input) =>
        ({ ...input, id: 'cycle-c' } as any)
      );

      const result = await service.evaluateCollectiveAfterCreate(
        'voskhod',
        'offer-c',
        'supplier1',
        10,
        '100.0000'
      );

      expect(result).not.toBeNull();
      const cycleArg = mocks.cycleRepo.create.mock.calls[0][0];
      expect(cycleArg.status).toBe('PENDING_SUPPLIER_ACCEPT');
      expect(cycleArg.cycle_type).toBe('collective');
      expect(cycleArg.total_quantity).toBe(12);
      expect(mocks.orderRepo.assignToCycle).toHaveBeenCalledWith(
        ['o1', 'o2'],
        'cycle-c',
        'ACCEPTED_PENDING_SUPPLIER'
      );
    });
  });

  describe('triggerCollectiveSupply', () => {
    it('создаёт ACCEPTED + Orders → ACCEPTED при ручном запуске поставщиком', async () => {
      const offer = buildOffer({
        id: 'offer-c',
        cycle_type: 'collective',
        supplier_account: 'supplier1',
      });
      mocks.offerRepo.findById.mockResolvedValue(offer);
      const pool = [
        buildOrder({ id: 'o1', offer_id: 'offer-c', quantity: 3 }),
        buildOrder({ id: 'o2', offer_id: 'offer-c', quantity: 4 }),
      ];
      mocks.orderRepo.findUnassignedActiveByOffer.mockResolvedValue(pool);
      mocks.cycleRepo.create.mockImplementation(async (input) =>
        ({ ...input, id: 'cycle-c' } as any)
      );

      const result = await service.triggerCollectiveSupply('voskhod', 'offer-c', 'supplier1');

      expect(result).toBeDefined();
      const cycleArg = mocks.cycleRepo.create.mock.calls[0][0];
      expect(cycleArg.status).toBe('ACCEPTED');
      expect(cycleArg.cycle_type).toBe('collective');
      expect(cycleArg.triggered_by_supplier_at).toBeInstanceOf(Date);
      expect(mocks.orderRepo.assignToCycle).toHaveBeenCalledWith(['o1', 'o2'], 'cycle-c', 'ACCEPTED');
      // ручной запуск = акцепт: per-Order on-chain acceptOrder
      expect(mocks.chainPort.acceptOrder).toHaveBeenCalledTimes(2);
    });

    it('Forbidden если запускает не владелец Offer\'а', async () => {
      mocks.offerRepo.findById.mockResolvedValue(buildOffer({ cycle_type: 'collective', supplier_account: 'other-supplier' }));
      await expect(service.triggerCollectiveSupply('voskhod', 'offer-c', 'supplier1')).rejects.toThrow(ForbiddenException);
    });

    it('BadRequest для cycle_type != collective', async () => {
      mocks.offerRepo.findById.mockResolvedValue(buildOffer({ cycle_type: 'individual', supplier_account: 'supplier1' }));
      await expect(service.triggerCollectiveSupply('voskhod', 'offer-i', 'supplier1')).rejects.toThrow(BadRequestException);
    });

    it('BadRequest при пустом пуле', async () => {
      mocks.offerRepo.findById.mockResolvedValue(buildOffer({ cycle_type: 'collective', supplier_account: 'supplier1' }));
      mocks.orderRepo.findUnassignedActiveByOffer.mockResolvedValue([]);
      await expect(service.triggerCollectiveSupply('voskhod', 'offer-c', 'supplier1')).rejects.toThrow(/Пул заказов пуст/);
    });
  });

  describe('expireUnacceptedPending (cron-cleanup PENDING > 48ч)', () => {
    it('переводит cycle в EXPIRED_NO_RESPONSE + expire-pool по cycle_id', async () => {
      const expiredCycle = {
        id: 'cycle-pending',
        coopname: 'voskhod',
        offer_id: 'offer-c',
        supplier_account: 'supplier1',
        expires_at: new Date('2026-05-01T00:00:00Z'),
      } as any;
      mocks.cycleRepo.findExpiredAwaitingResponse.mockResolvedValue([expiredCycle]);
      const pool = [
        buildOrder({ id: 'o1', offer_id: 'offer-c', order_hash: 'h-o1', quantity: 3, cycle_id: 'cycle-pending' }),
        buildOrder({ id: 'o2', offer_id: 'offer-c', order_hash: 'h-o2', quantity: 4, cycle_id: 'cycle-pending' }),
      ];
      mocks.orderRepo.findByCycleId.mockResolvedValue(pool);

      await service.expireUnacceptedPending();

      expect(mocks.cycleRepo.applyStatusTransition).toHaveBeenCalledWith(
        'cycle-pending',
        'EXPIRED_NO_RESPONSE',
        { decline_reason: 'expired_no_response' }
      );
      expect(mocks.chainPort.expireOrder).toHaveBeenCalledTimes(2);
      expect(mocks.offerCounters.onOrderUnblocked).toHaveBeenCalledTimes(2);
      expect(mocks.orderRepo.applyStatusTransition).toHaveBeenCalledWith(
        'o1',
        'CANCELLED_BY_SUPPLIER',
        expect.stringContaining('expired_no_response')
      );
    });

    it('пустой список истёкших заявок — early return без расходов', async () => {
      mocks.cycleRepo.findExpiredAwaitingResponse.mockResolvedValue([]);

      await service.expireUnacceptedPending();

      expect(mocks.cycleRepo.applyStatusTransition).not.toHaveBeenCalled();
      expect(mocks.chainPort.expireOrder).not.toHaveBeenCalled();
    });

    it('chain.expireOrder упал на одном Order — остальные обрабатываются, лог error без throw', async () => {
      const expiredCycle = {
        id: 'cycle-pf',
        coopname: 'voskhod',
        offer_id: 'offer-c',
        supplier_account: 'supplier1',
        expires_at: new Date('2026-05-01T00:00:00Z'),
      } as any;
      mocks.cycleRepo.findExpiredAwaitingResponse.mockResolvedValue([expiredCycle]);
      const pool = [
        buildOrder({ id: 'o1', offer_id: 'offer-c', order_hash: 'h-o1', quantity: 3, cycle_id: 'cycle-pf' }),
        buildOrder({ id: 'o2', offer_id: 'offer-c', order_hash: 'h-o2', quantity: 5, cycle_id: 'cycle-pf' }),
        buildOrder({ id: 'o3', offer_id: 'offer-c', order_hash: 'h-o3', quantity: 2, cycle_id: 'cycle-pf' }),
      ];
      mocks.orderRepo.findByCycleId.mockResolvedValue(pool);
      mocks.chainPort.expireOrder.mockImplementation(async (data: any) => {
        if (data.order_hash === 'h-o2') throw new Error('chain reject: tx timeout');
        return {} as any;
      });

      await service.expireUnacceptedPending();

      expect(mocks.chainPort.expireOrder).toHaveBeenCalledTimes(3);
      // counter + applyStatusTransition только для успешных (2)
      expect(mocks.offerCounters.onOrderUnblocked).toHaveBeenCalledTimes(2);
      expect(mocks.orderRepo.applyStatusTransition).toHaveBeenCalledTimes(2);
      expect(mocks.orderRepo.applyStatusTransition).not.toHaveBeenCalledWith(
        'o2',
        expect.anything(),
        expect.anything()
      );
      expect(mocks.logger.error).toHaveBeenCalled();
    });

    it('counter onOrderUnblocked упал — applyStatusTransition всё равно вызывается (best-effort)', async () => {
      const expiredCycle = {
        id: 'cycle-cf',
        coopname: 'voskhod',
        offer_id: 'offer-c',
        supplier_account: 'supplier1',
        expires_at: new Date('2026-05-01T00:00:00Z'),
      } as any;
      mocks.cycleRepo.findExpiredAwaitingResponse.mockResolvedValue([expiredCycle]);
      mocks.orderRepo.findByCycleId.mockResolvedValue([
        buildOrder({ id: 'o1', offer_id: 'offer-c', order_hash: 'h-o1', quantity: 3, cycle_id: 'cycle-cf' }),
      ]);
      mocks.offerCounters.onOrderUnblocked.mockRejectedValue(new Error('Offer не найден'));

      await service.expireUnacceptedPending();

      expect(mocks.chainPort.expireOrder).toHaveBeenCalledTimes(1);
      expect(mocks.orderRepo.applyStatusTransition).toHaveBeenCalledWith(
        'o1',
        'CANCELLED_BY_SUPPLIER',
        expect.any(String)
      );
      expect(mocks.logger.warn).toHaveBeenCalled();
    });
  });
});
