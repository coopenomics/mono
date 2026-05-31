import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { MarketplaceOrderSupplierActionService } from './marketplace-order-supplier-action.service';
import type { MarketplaceOrderDomainEntity } from '../../domain/entities/marketplace-order.entity';
import type { MarketplaceOrderDomainRepository } from '../../domain/repositories/marketplace-order.repository';
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
    cycle_type: 'individual',
    cycle_id: null,
    status: 'ACCEPTED_PENDING_SUPPLIER_INDIVIDUAL',
    ...overrides,
  } as MarketplaceOrderDomainEntity;
}

function buildMocks() {
  const orderRepo: jest.Mocked<MarketplaceOrderDomainRepository> = {
    findById: jest.fn(),
    applyStatusTransition: jest
      .fn()
      .mockImplementation(async (id, status, reason) => buildOrder({ id, status, last_status_reason: reason } as any)),
    assignToCycle: jest.fn().mockResolvedValue(undefined as any),
  } as unknown as jest.Mocked<MarketplaceOrderDomainRepository>;

  // individual accept оборачивает заказ в синтетическую заявку (cycle) в статусе
  // ACCEPTED — best-effort; партию поставщик формирует явно отдельным шагом
  // (Story 14.1), shipment-create здесь не вызывается.
  const cycleRepo: jest.Mocked<MarketplaceConsolidatedRequestDomainRepository> = {
    create: jest.fn().mockResolvedValue({ id: 'cycle-1' } as any),
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

describe('MarketplaceOrderSupplierActionService', () => {
  let mocks: ReturnType<typeof buildMocks>;
  let service: MarketplaceOrderSupplierActionService;

  beforeEach(() => {
    mocks = buildMocks();
    service = new MarketplaceOrderSupplierActionService(
      mocks.orderRepo,
      mocks.cycleRepo,
      mocks.offerCounters,
      mocks.chainPort,
      mocks.logger
    );
  });

  describe('acceptIndividual', () => {
    it('happy path — chain.acceptOrder + applyStatusTransition ACCEPTED, counter не дёргается', async () => {
      mocks.orderRepo.findById.mockResolvedValue(buildOrder());

      const result = await service.acceptIndividual({
        coopname: 'voskhod',
        offerer_account: 'supplier1',
        order_id: 'order-1',
      });

      expect(mocks.chainPort.acceptOrder).toHaveBeenCalledWith({
        coopname: 'voskhod',
        offerer: 'supplier1',
        order_hash: 'h-order-1',
      });
      expect(mocks.orderRepo.applyStatusTransition).toHaveBeenCalledWith('order-1', 'ACCEPTED', 'Принят поставщиком');
      expect(mocks.offerCounters.onOrderUnblocked).not.toHaveBeenCalled();
      expect(result.tx_hash).toBe('tx-acc-1');
    });

    it('NotFound — Order не найден', async () => {
      mocks.orderRepo.findById.mockResolvedValue(null);
      await expect(
        service.acceptIndividual({ coopname: 'voskhod', offerer_account: 'supplier1', order_id: 'missing' })
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('Forbidden — не владелец Offer\'а', async () => {
      mocks.orderRepo.findById.mockResolvedValue(buildOrder({ supplier_account: 'someone-else' }));
      await expect(
        service.acceptIndividual({ coopname: 'voskhod', offerer_account: 'supplier1', order_id: 'order-1' })
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it.each(['time_based', 'volume_based', 'open_subscription'] as const)(
      'BadRequest для cycle_type=%s — accept individual недоступен',
      async (cycle_type) => {
        mocks.orderRepo.findById.mockResolvedValue(buildOrder({ cycle_type } as any));
        await expect(
          service.acceptIndividual({ coopname: 'voskhod', offerer_account: 'supplier1', order_id: 'order-1' })
        ).rejects.toBeInstanceOf(BadRequestException);
      }
    );

    it.each(['ACTIVE', 'ACCEPTED', 'CANCELLED_BY_ORDERER'] as const)(
      'BadRequest для status=%s',
      async (status) => {
        mocks.orderRepo.findById.mockResolvedValue(buildOrder({ status } as any));
        await expect(
          service.acceptIndividual({ coopname: 'voskhod', offerer_account: 'supplier1', order_id: 'order-1' })
        ).rejects.toBeInstanceOf(BadRequestException);
      }
    );

    it('chain.acceptOrder fail → BadRequest, applyStatusTransition не вызван', async () => {
      mocks.orderRepo.findById.mockResolvedValue(buildOrder());
      mocks.chainPort.acceptOrder.mockRejectedValue(
        new Error('assertion failure with message: order not found\nat eosio')
      );
      await expect(
        service.acceptIndividual({ coopname: 'voskhod', offerer_account: 'supplier1', order_id: 'order-1' })
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(mocks.orderRepo.applyStatusTransition).not.toHaveBeenCalled();
    });
  });

  describe('declineIndividual', () => {
    it('happy path — declineOrder + counter unblk + applyStatusTransition CANCELLED_BY_SUPPLIER', async () => {
      mocks.orderRepo.findById.mockResolvedValue(buildOrder({ quantity: 7 }));

      const result = await service.declineIndividual({
        coopname: 'voskhod',
        offerer_account: 'supplier1',
        order_id: 'order-1',
        reason: 'нет ресурса',
      });

      expect(mocks.chainPort.declineOrder).toHaveBeenCalledWith({
        coopname: 'voskhod',
        offerer: 'supplier1',
        order_hash: 'h-order-1',
      });
      expect(mocks.offerCounters.onOrderUnblocked).toHaveBeenCalledWith('offer-1', 7);
      expect(mocks.orderRepo.applyStatusTransition).toHaveBeenCalledWith('order-1', 'CANCELLED_BY_SUPPLIER', 'нет ресурса');
      expect(result.tx_hash).toBe('tx-dec-1');
    });

    it('counter fail tolerance — applyStatusTransition всё равно', async () => {
      mocks.orderRepo.findById.mockResolvedValue(buildOrder());
      mocks.offerCounters.onOrderUnblocked.mockRejectedValue(new Error('offer hard-deleted'));

      await service.declineIndividual({
        coopname: 'voskhod',
        offerer_account: 'supplier1',
        order_id: 'order-1',
        reason: 'no stock',
      });
      expect(mocks.orderRepo.applyStatusTransition).toHaveBeenCalledWith('order-1', 'CANCELLED_BY_SUPPLIER', 'no stock');
      expect(mocks.logger.warn).toHaveBeenCalled();
    });

    it('BadRequest — пустой reason', async () => {
      await expect(
        service.declineIndividual({ coopname: 'voskhod', offerer_account: 'supplier1', order_id: 'order-1', reason: '' })
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(mocks.orderRepo.findById).not.toHaveBeenCalled();
    });

    it('BadRequest для cycle_type=time_based — decline individual недоступен', async () => {
      mocks.orderRepo.findById.mockResolvedValue(buildOrder({ cycle_type: 'time_based' as any }));
      await expect(
        service.declineIndividual({ coopname: 'voskhod', offerer_account: 'supplier1', order_id: 'order-1', reason: 'x' })
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('chain fail → BadRequest, counter не дёргается', async () => {
      mocks.orderRepo.findById.mockResolvedValue(buildOrder());
      mocks.chainPort.declineOrder.mockRejectedValue(new Error('chain timeout'));
      await expect(
        service.declineIndividual({ coopname: 'voskhod', offerer_account: 'supplier1', order_id: 'order-1', reason: 'x' })
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(mocks.offerCounters.onOrderUnblocked).not.toHaveBeenCalled();
      expect(mocks.orderRepo.applyStatusTransition).not.toHaveBeenCalled();
    });
  });

  describe('declineFromOpenPool', () => {
    it('happy path — Order ACTIVE + cycle_id=null + cycle_type=open_subscription → decline', async () => {
      mocks.orderRepo.findById.mockResolvedValue(
        buildOrder({ cycle_type: 'open_subscription' as any, status: 'ACTIVE' as any, cycle_id: null, quantity: 4 })
      );

      const result = await service.declineFromOpenPool({
        coopname: 'voskhod',
        offerer_account: 'supplier1',
        order_id: 'order-1',
        reason: 'излишек',
      });

      expect(mocks.chainPort.declineOrder).toHaveBeenCalledTimes(1);
      expect(mocks.offerCounters.onOrderUnblocked).toHaveBeenCalledWith('offer-1', 4);
      expect(mocks.orderRepo.applyStatusTransition).toHaveBeenCalledWith('order-1', 'CANCELLED_BY_SUPPLIER', 'излишек');
      expect(result.tx_hash).toBe('tx-dec-1');
    });

    it('BadRequest для cycle_type=individual — недоступно (только open_subscription)', async () => {
      mocks.orderRepo.findById.mockResolvedValue(buildOrder({ cycle_type: 'individual' as any, status: 'ACTIVE' as any }));
      await expect(
        service.declineFromOpenPool({
          coopname: 'voskhod',
          offerer_account: 'supplier1',
          order_id: 'order-1',
          reason: 'x',
        })
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('BadRequest — cycle_id уже выставлен (пул запущен)', async () => {
      mocks.orderRepo.findById.mockResolvedValue(
        buildOrder({ cycle_type: 'open_subscription' as any, status: 'ACCEPTED' as any, cycle_id: 'cycle-2' })
      );
      await expect(
        service.declineFromOpenPool({
          coopname: 'voskhod',
          offerer_account: 'supplier1',
          order_id: 'order-1',
          reason: 'x',
        })
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('BadRequest — статус не ACTIVE', async () => {
      mocks.orderRepo.findById.mockResolvedValue(
        buildOrder({ cycle_type: 'open_subscription' as any, status: 'CANCELLED_BY_ORDERER' as any, cycle_id: null })
      );
      await expect(
        service.declineFromOpenPool({
          coopname: 'voskhod',
          offerer_account: 'supplier1',
          order_id: 'order-1',
          reason: 'x',
        })
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
