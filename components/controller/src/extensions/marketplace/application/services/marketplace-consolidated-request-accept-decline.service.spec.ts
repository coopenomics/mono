import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { MarketplaceConsolidatedRequestAcceptDeclineService } from './marketplace-consolidated-request-accept-decline.service';
import type { MarketplaceOrderDomainEntity } from '../../domain/entities/marketplace-order.entity';
import type { MarketplaceOrderDomainRepository } from '../../domain/repositories/marketplace-order.repository';
import type { MarketplaceConsolidatedRequestDomainEntity } from '../../domain/entities/marketplace-consolidated-request.entity';
import type { MarketplaceConsolidatedRequestDomainRepository } from '../../domain/repositories/marketplace-consolidated-request.repository';
import type { MarketplaceOfferCountersService } from './marketplace-offer-counters.service';
import type { MarketplaceCanonicalBlockchainPort } from '../../domain/ports/marketplace-canonical-blockchain.port';

function buildOrder(overrides: Partial<MarketplaceOrderDomainEntity> = {}): MarketplaceOrderDomainEntity {
  return {
    id: 'order-1',
    coopname: 'voskhod',
    order_hash: 'h-order-1',
    orderer_account: 'orderer1',
    offer_id: 'offer-1',
    supplier_account: 'supplier1',
    quantity: 5,
    price_per_unit: '150.0000',
    total_cost: '750.0000',
    cycle_type: 'collective',
    cycle_id: 'cycle-1',
    status: 'ACCEPTED_PENDING_SUPPLIER',
    ...overrides,
  } as MarketplaceOrderDomainEntity;
}

function buildCycle(
  overrides: Partial<MarketplaceConsolidatedRequestDomainEntity> = {}
): MarketplaceConsolidatedRequestDomainEntity {
  return {
    id: 'cycle-1',
    coopname: 'voskhod',
    offer_id: 'offer-1',
    supplier_account: 'supplier1',
    cycle_type: 'collective',
    total_quantity: 10,
    total_amount: '1500.0000',
    status: 'PENDING_SUPPLIER_ACCEPT',
    cycle_started_at: new Date('2026-05-01T00:00:00Z'),
    cycle_ended_at: new Date('2026-05-08T00:00:00Z'),
    expires_at: new Date('2026-05-10T00:00:00Z'),
    accepted_at: null,
    declined_at: null,
    decline_reason: null,
    triggered_by_supplier_at: null,
    created_at: new Date('2026-05-08T00:00:00Z'),
    updated_at: new Date('2026-05-08T00:00:00Z'),
    ...overrides,
  } as MarketplaceConsolidatedRequestDomainEntity;
}

function buildMocks() {
  const orderRepo: jest.Mocked<MarketplaceOrderDomainRepository> = {
    findByCycleId: jest.fn(),
    applyStatusTransition: jest
      .fn()
      .mockImplementation(async (id, status, reason) => buildOrder({ id, status, last_status_reason: reason } as any)),
  } as unknown as jest.Mocked<MarketplaceOrderDomainRepository>;

  const cycleRepo: jest.Mocked<MarketplaceConsolidatedRequestDomainRepository> = {
    findById: jest.fn(),
    applyStatusTransition: jest
      .fn()
      .mockImplementation(async (id, newStatus, options) =>
        buildCycle({ id, status: newStatus, decline_reason: options?.decline_reason ?? null } as any)
      ),
  } as unknown as jest.Mocked<MarketplaceConsolidatedRequestDomainRepository>;

  const offerCounters: jest.Mocked<MarketplaceOfferCountersService> = {
    onOrderUnblocked: jest.fn().mockResolvedValue({} as any),
  } as unknown as jest.Mocked<MarketplaceOfferCountersService>;

  const chainPort: jest.Mocked<MarketplaceCanonicalBlockchainPort> = {
    acceptOrder: jest.fn().mockResolvedValue({ transaction: { id: 'tx-acc-1' } } as any),
    declineOrder: jest.fn().mockResolvedValue({ transaction: { id: 'tx-dec-1' } } as any),
  } as unknown as jest.Mocked<MarketplaceCanonicalBlockchainPort>;

  const logger = {
    setContext: jest.fn(),
    debug: jest.fn(),
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  } as any;

  return { orderRepo, cycleRepo, offerCounters, chainPort, logger };
}

describe('MarketplaceConsolidatedRequestAcceptDeclineService', () => {
  let mocks: ReturnType<typeof buildMocks>;
  let service: MarketplaceConsolidatedRequestAcceptDeclineService;

  beforeEach(() => {
    mocks = buildMocks();
    service = new MarketplaceConsolidatedRequestAcceptDeclineService(
      mocks.orderRepo,
      mocks.cycleRepo,
      mocks.offerCounters,
      mocks.chainPort,
      mocks.logger
    );
  });

  describe('accept', () => {
    it('happy path — chain.acceptOrder per-Order + applyStatusTransition ACCEPTED + cycle → ACCEPTED', async () => {
      mocks.cycleRepo.findById.mockResolvedValue(buildCycle());
      mocks.orderRepo.findByCycleId.mockResolvedValue([
        buildOrder({ id: 'order-1', order_hash: 'h1' }),
        buildOrder({ id: 'order-2', order_hash: 'h2' }),
      ]);

      const result = await service.accept({
        coopname: 'voskhod',
        offerer_account: 'supplier1',
        request_id: 'cycle-1',
      });

      expect(mocks.chainPort.acceptOrder).toHaveBeenCalledTimes(2);
      expect(mocks.chainPort.acceptOrder).toHaveBeenCalledWith({
        coopname: 'voskhod',
        offerer: 'supplier1',
        order_hash: 'h1',
      });
      expect(mocks.orderRepo.applyStatusTransition).toHaveBeenCalledWith('order-1', 'ACCEPTED', 'Принят поставщиком');
      expect(mocks.orderRepo.applyStatusTransition).toHaveBeenCalledWith('order-2', 'ACCEPTED', 'Принят поставщиком');
      expect(mocks.cycleRepo.applyStatusTransition).toHaveBeenCalledWith('cycle-1', 'ACCEPTED');
      expect(result.affected_orders).toBe(2);
      expect(result.on_chain_succeeded).toBe(2);
      expect(result.on_chain_failed).toBe(0);
      expect(mocks.offerCounters.onOrderUnblocked).not.toHaveBeenCalled();
    });

    it('partial chain fail tolerance — один Order падает, остальные идут, cycle → ACCEPTED', async () => {
      mocks.cycleRepo.findById.mockResolvedValue(buildCycle());
      mocks.orderRepo.findByCycleId.mockResolvedValue([
        buildOrder({ id: 'order-1', order_hash: 'h1' }),
        buildOrder({ id: 'order-2', order_hash: 'h2' }),
      ]);
      mocks.chainPort.acceptOrder.mockImplementation(async (data) => {
        if (data.order_hash === 'h1') throw new Error('chain rpc timeout');
        return { transaction: { id: 'tx-2' } } as any;
      });

      const result = await service.accept({
        coopname: 'voskhod',
        offerer_account: 'supplier1',
        request_id: 'cycle-1',
      });

      expect(result.affected_orders).toBe(2);
      expect(result.on_chain_succeeded).toBe(1);
      expect(result.on_chain_failed).toBe(1);
      expect(mocks.orderRepo.applyStatusTransition).toHaveBeenCalledTimes(1);
      expect(mocks.orderRepo.applyStatusTransition).toHaveBeenCalledWith('order-2', 'ACCEPTED', 'Принят поставщиком');
      expect(mocks.cycleRepo.applyStatusTransition).toHaveBeenCalledWith('cycle-1', 'ACCEPTED');
      expect(mocks.logger.error).toHaveBeenCalled();
    });

    it('NotFoundException — заявка не найдена', async () => {
      mocks.cycleRepo.findById.mockResolvedValue(null);
      await expect(
        service.accept({ coopname: 'voskhod', offerer_account: 'supplier1', request_id: 'missing' })
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('Forbidden — другой кооператив', async () => {
      mocks.cycleRepo.findById.mockResolvedValue(buildCycle({ coopname: 'other-coop' }));
      await expect(
        service.accept({ coopname: 'voskhod', offerer_account: 'supplier1', request_id: 'cycle-1' })
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('Forbidden — не владелец заявки', async () => {
      mocks.cycleRepo.findById.mockResolvedValue(buildCycle({ supplier_account: 'someone-else' }));
      await expect(
        service.accept({ coopname: 'voskhod', offerer_account: 'supplier1', request_id: 'cycle-1' })
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it.each(['individual'] as const)(
      'BadRequest для cycle_type=%s — accept недоступен для не-collective',
      async (cycle_type) => {
        mocks.cycleRepo.findById.mockResolvedValue(buildCycle({ cycle_type } as any));
        await expect(
          service.accept({ coopname: 'voskhod', offerer_account: 'supplier1', request_id: 'cycle-1' })
        ).rejects.toBeInstanceOf(BadRequestException);
      }
    );

    it.each(['ACCEPTED', 'DECLINED_BY_SUPPLIER', 'EXPIRED_NO_RESPONSE'] as const)(
      'BadRequest для status=%s',
      async (status) => {
        mocks.cycleRepo.findById.mockResolvedValue(buildCycle({ status } as any));
        await expect(
          service.accept({ coopname: 'voskhod', offerer_account: 'supplier1', request_id: 'cycle-1' })
        ).rejects.toBeInstanceOf(BadRequestException);
      }
    );
  });

  describe('decline', () => {
    it('happy path — chain.declineOrder + counter unblk + Order → CANCELLED_BY_SUPPLIER + cycle → DECLINED_BY_SUPPLIER', async () => {
      mocks.cycleRepo.findById.mockResolvedValue(buildCycle());
      mocks.orderRepo.findByCycleId.mockResolvedValue([
        buildOrder({ id: 'order-1', order_hash: 'h1', offer_id: 'offer-1', quantity: 5 }),
        buildOrder({ id: 'order-2', order_hash: 'h2', offer_id: 'offer-1', quantity: 3 }),
      ]);

      const result = await service.decline({
        coopname: 'voskhod',
        offerer_account: 'supplier1',
        request_id: 'cycle-1',
        reason: 'нет ресурсов на цикл',
      });

      expect(mocks.chainPort.declineOrder).toHaveBeenCalledTimes(2);
      expect(mocks.offerCounters.onOrderUnblocked).toHaveBeenCalledWith('offer-1', 5);
      expect(mocks.offerCounters.onOrderUnblocked).toHaveBeenCalledWith('offer-1', 3);
      expect(mocks.orderRepo.applyStatusTransition).toHaveBeenCalledWith(
        'order-1',
        'CANCELLED_BY_SUPPLIER',
        'нет ресурсов на цикл'
      );
      expect(mocks.cycleRepo.applyStatusTransition).toHaveBeenCalledWith('cycle-1', 'DECLINED_BY_SUPPLIER', {
        decline_reason: 'нет ресурсов на цикл',
      });
      expect(result.on_chain_succeeded).toBe(2);
    });

    it('counter fail tolerance — applyStatusTransition CANCELLED_BY_SUPPLIER всё равно', async () => {
      mocks.cycleRepo.findById.mockResolvedValue(buildCycle());
      mocks.orderRepo.findByCycleId.mockResolvedValue([buildOrder({ id: 'order-1', order_hash: 'h1' })]);
      mocks.offerCounters.onOrderUnblocked.mockRejectedValue(new Error('offer not found'));

      const result = await service.decline({
        coopname: 'voskhod',
        offerer_account: 'supplier1',
        request_id: 'cycle-1',
        reason: 'отказ',
      });

      expect(mocks.orderRepo.applyStatusTransition).toHaveBeenCalledWith('order-1', 'CANCELLED_BY_SUPPLIER', 'отказ');
      expect(mocks.logger.warn).toHaveBeenCalled();
      expect(result.on_chain_succeeded).toBe(1);
    });

    it('BadRequest — пустой reason', async () => {
      await expect(
        service.decline({ coopname: 'voskhod', offerer_account: 'supplier1', request_id: 'cycle-1', reason: '   ' })
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(mocks.cycleRepo.findById).not.toHaveBeenCalled();
    });

    it('partial chain fail — один Order падает, второй идёт, counter не дёргается на провалившийся', async () => {
      mocks.cycleRepo.findById.mockResolvedValue(buildCycle());
      mocks.orderRepo.findByCycleId.mockResolvedValue([
        buildOrder({ id: 'order-1', order_hash: 'h1', quantity: 5 }),
        buildOrder({ id: 'order-2', order_hash: 'h2', quantity: 3 }),
      ]);
      mocks.chainPort.declineOrder.mockImplementation(async (data) => {
        if (data.order_hash === 'h1') throw new Error('chain rpc fail');
        return { transaction: { id: 'tx-2' } } as any;
      });

      const result = await service.decline({
        coopname: 'voskhod',
        offerer_account: 'supplier1',
        request_id: 'cycle-1',
        reason: 'no resources',
      });

      expect(result.on_chain_succeeded).toBe(1);
      expect(result.on_chain_failed).toBe(1);
      expect(mocks.offerCounters.onOrderUnblocked).toHaveBeenCalledTimes(1);
      expect(mocks.offerCounters.onOrderUnblocked).toHaveBeenCalledWith('offer-1', 3);
      expect(mocks.orderRepo.applyStatusTransition).toHaveBeenCalledTimes(1);
      expect(mocks.cycleRepo.applyStatusTransition).toHaveBeenCalledWith('cycle-1', 'DECLINED_BY_SUPPLIER', {
        decline_reason: 'no resources',
      });
    });
  });
});
