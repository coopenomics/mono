import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { MarketplaceCycleAggregatorService } from './marketplace-cycle-aggregator.service';
import type { MarketplaceOfferDomainEntity } from '../../domain/entities/marketplace-offer.entity';
import type { MarketplaceOrderDomainEntity } from '../../domain/entities/marketplace-order.entity';
import type { MarketplaceOfferDomainRepository } from '../../domain/repositories/marketplace-offer.repository';
import type { MarketplaceOrderDomainRepository } from '../../domain/repositories/marketplace-order.repository';
import type { MarketplaceConsolidatedRequestDomainRepository } from '../../domain/repositories/marketplace-consolidated-request.repository';

function buildOffer(overrides: Partial<MarketplaceOfferDomainEntity> = {}): MarketplaceOfferDomainEntity {
  return {
    id: 'offer-vb',
    coopname: 'voskhod',
    supplier_account: 'supplier1',
    price_per_unit: '100.0000',
    cycle_type: 'time_based',
    cycle_days: 7,
    target_volume: null,
    max_wait_days: null,
    min_threshold: null,
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
    offer_id: 'offer-vb',
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
    listAllActiveTimeBased: jest.fn(),
    listAllActiveVolumeBased: jest.fn(),
  } as unknown as jest.Mocked<MarketplaceOfferDomainRepository>;

  const orderRepo: jest.Mocked<MarketplaceOrderDomainRepository> = {
    findUnassignedActiveByOffer: jest.fn(),
    sumUnassignedActiveByOffer: jest.fn(),
    assignToCycle: jest.fn(),
  } as unknown as jest.Mocked<MarketplaceOrderDomainRepository>;

  const cycleRepo: jest.Mocked<MarketplaceConsolidatedRequestDomainRepository> = {
    create: jest.fn(),
    applyStatusTransition: jest.fn(),
  } as unknown as jest.Mocked<MarketplaceConsolidatedRequestDomainRepository>;

  const logger = {
    setContext: jest.fn(),
    debug: jest.fn(),
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  } as any;

  return { offerRepo, orderRepo, cycleRepo, logger };
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
      mocks.logger
    );
  });

  describe('aggregateTimeBased', () => {
    it('создаёт PENDING_SUPPLIER_ACCEPT при достижении cycle_end и sum >= min_threshold', async () => {
      const cycleStart = new Date('2026-05-01T00:00:00Z');
      const offer = buildOffer({
        id: 'offer-tb',
        cycle_type: 'time_based',
        cycle_days: 7,
        min_threshold: 10,
      });
      const pool = [
        buildOrder({ id: 'o1', offer_id: 'offer-tb', quantity: 6, blocked_at: cycleStart }),
        buildOrder({ id: 'o2', offer_id: 'offer-tb', quantity: 5, blocked_at: cycleStart }),
      ];
      mocks.offerRepo.listAllActiveTimeBased.mockResolvedValue([offer]);
      mocks.orderRepo.findUnassignedActiveByOffer.mockResolvedValue(pool);
      mocks.cycleRepo.create.mockImplementation(async (input) =>
        ({ ...input, id: 'cycle-1', created_at: new Date(), updated_at: new Date() } as any)
      );
      mocks.orderRepo.assignToCycle.mockResolvedValue(2);

      // Симулируем that aggregateTimeBased вызывается ПОЗЖЕ cycle_end:
      jest.useFakeTimers().setSystemTime(new Date('2026-05-10T12:00:00Z'));
      try {
        await service.aggregateTimeBased();
      } finally {
        jest.useRealTimers();
      }

      expect(mocks.cycleRepo.create).toHaveBeenCalledTimes(1);
      const cycleArg = mocks.cycleRepo.create.mock.calls[0][0];
      expect(cycleArg.status).toBe('PENDING_SUPPLIER_ACCEPT');
      expect(cycleArg.total_quantity).toBe(11);
      expect(cycleArg.total_amount).toBe('1100.0000');
      expect(mocks.orderRepo.assignToCycle).toHaveBeenCalledWith(
        ['o1', 'o2'],
        'cycle-1',
        'ACCEPTED_PENDING_SUPPLIER'
      );
    });

    it('создаёт EXPIRED_NO_THRESHOLD при cycle_end и sum < min_threshold (без assignToCycle)', async () => {
      const cycleStart = new Date('2026-05-01T00:00:00Z');
      const offer = buildOffer({
        id: 'offer-tb',
        cycle_type: 'time_based',
        cycle_days: 7,
        min_threshold: 20,
      });
      const pool = [
        buildOrder({ id: 'o1', offer_id: 'offer-tb', quantity: 3, blocked_at: cycleStart }),
      ];
      mocks.offerRepo.listAllActiveTimeBased.mockResolvedValue([offer]);
      mocks.orderRepo.findUnassignedActiveByOffer.mockResolvedValue(pool);
      mocks.cycleRepo.create.mockResolvedValue({ id: 'cycle-x' } as any);

      jest.useFakeTimers().setSystemTime(new Date('2026-05-10T12:00:00Z'));
      try {
        await service.aggregateTimeBased();
      } finally {
        jest.useRealTimers();
      }

      expect(mocks.cycleRepo.create.mock.calls[0][0].status).toBe('EXPIRED_NO_THRESHOLD');
      expect(mocks.orderRepo.assignToCycle).not.toHaveBeenCalled();
    });

    it('не делает ничего пока cycle_end не достигнут', async () => {
      const cycleStart = new Date('2026-05-01T00:00:00Z');
      const offer = buildOffer({ id: 'offer-tb', cycle_type: 'time_based', cycle_days: 7 });
      const pool = [buildOrder({ id: 'o1', offer_id: 'offer-tb', quantity: 5, blocked_at: cycleStart })];
      mocks.offerRepo.listAllActiveTimeBased.mockResolvedValue([offer]);
      mocks.orderRepo.findUnassignedActiveByOffer.mockResolvedValue(pool);

      jest.useFakeTimers().setSystemTime(new Date('2026-05-03T12:00:00Z')); // только 2 дня прошло
      try {
        await service.aggregateTimeBased();
      } finally {
        jest.useRealTimers();
      }

      expect(mocks.cycleRepo.create).not.toHaveBeenCalled();
    });
  });

  describe('evaluateVolumeBasedAfterCreate', () => {
    it('возвращает null если sum < target_volume', async () => {
      mocks.orderRepo.sumUnassignedActiveByOffer.mockResolvedValue(7);

      const result = await service.evaluateVolumeBasedAfterCreate(
        'voskhod',
        'offer-vb',
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
        buildOrder({ id: 'o1', offer_id: 'offer-vb', quantity: 7 }),
        buildOrder({ id: 'o2', offer_id: 'offer-vb', quantity: 5 }),
      ]);
      mocks.cycleRepo.create.mockImplementation(async (input) =>
        ({ ...input, id: 'cycle-vb' } as any)
      );

      const result = await service.evaluateVolumeBasedAfterCreate(
        'voskhod',
        'offer-vb',
        'supplier1',
        10,
        '100.0000'
      );

      expect(result).not.toBeNull();
      const cycleArg = mocks.cycleRepo.create.mock.calls[0][0];
      expect(cycleArg.status).toBe('PENDING_SUPPLIER_ACCEPT');
      expect(cycleArg.cycle_type).toBe('volume_based');
      expect(cycleArg.total_quantity).toBe(12);
      expect(mocks.orderRepo.assignToCycle).toHaveBeenCalledWith(
        ['o1', 'o2'],
        'cycle-vb',
        'ACCEPTED_PENDING_SUPPLIER'
      );
    });
  });

  describe('triggerOpenSubscription', () => {
    it('создаёт ACCEPTED + Orders → ACCEPTED при ручном запуске поставщиком', async () => {
      const offer = buildOffer({
        id: 'offer-os',
        cycle_type: 'open_subscription',
        supplier_account: 'supplier1',
      });
      mocks.offerRepo.findById.mockResolvedValue(offer);
      const pool = [
        buildOrder({ id: 'o1', offer_id: 'offer-os', quantity: 3 }),
        buildOrder({ id: 'o2', offer_id: 'offer-os', quantity: 4 }),
      ];
      mocks.orderRepo.findUnassignedActiveByOffer.mockResolvedValue(pool);
      mocks.cycleRepo.create.mockImplementation(async (input) =>
        ({ ...input, id: 'cycle-os' } as any)
      );

      const result = await service.triggerOpenSubscription('voskhod', 'offer-os', 'supplier1');

      expect(result).toBeDefined();
      const cycleArg = mocks.cycleRepo.create.mock.calls[0][0];
      expect(cycleArg.status).toBe('ACCEPTED');
      expect(cycleArg.cycle_type).toBe('open_subscription');
      expect(cycleArg.triggered_by_supplier_at).toBeInstanceOf(Date);
      expect(mocks.orderRepo.assignToCycle).toHaveBeenCalledWith(['o1', 'o2'], 'cycle-os', 'ACCEPTED');
    });

    it('Forbidden если запускает не владелец Offer\'а', async () => {
      mocks.offerRepo.findById.mockResolvedValue(buildOffer({ cycle_type: 'open_subscription', supplier_account: 'other-supplier' }));
      await expect(service.triggerOpenSubscription('voskhod', 'offer-os', 'supplier1')).rejects.toThrow(ForbiddenException);
    });

    it('BadRequest для cycle_type != open_subscription', async () => {
      mocks.offerRepo.findById.mockResolvedValue(buildOffer({ cycle_type: 'time_based', supplier_account: 'supplier1' }));
      await expect(service.triggerOpenSubscription('voskhod', 'offer-tb', 'supplier1')).rejects.toThrow(BadRequestException);
    });

    it('BadRequest при пустом пуле', async () => {
      mocks.offerRepo.findById.mockResolvedValue(buildOffer({ cycle_type: 'open_subscription', supplier_account: 'supplier1' }));
      mocks.orderRepo.findUnassignedActiveByOffer.mockResolvedValue([]);
      await expect(service.triggerOpenSubscription('voskhod', 'offer-os', 'supplier1')).rejects.toThrow(/Пул заказов пуст/);
    });
  });
});
