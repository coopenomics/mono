import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { MarketplaceOrderCancelService } from './marketplace-order-cancel.service';
import type { MarketplaceOrderDomainEntity } from '../../domain/entities/marketplace-order.entity';
import type { MarketplaceOrderDomainRepository } from '../../domain/repositories/marketplace-order.repository';
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
    cycle_id: null,
    status: 'ACTIVE',
    blocked_at: new Date('2026-05-01T10:00:00Z'),
    created_at: new Date('2026-05-01T10:00:00Z'),
    ...overrides,
  } as MarketplaceOrderDomainEntity;
}

function buildMocks() {
  const orderRepo: jest.Mocked<MarketplaceOrderDomainRepository> = {
    findById: jest.fn(),
    applyStatusTransition: jest.fn().mockImplementation(async (id, status, reason) =>
      buildOrder({ id, status, last_status_reason: reason } as any)
    ),
  } as unknown as jest.Mocked<MarketplaceOrderDomainRepository>;

  const offerCounters: jest.Mocked<MarketplaceOfferCountersService> = {
    onOrderUnblocked: jest.fn().mockResolvedValue({} as any),
  } as unknown as jest.Mocked<MarketplaceOfferCountersService>;

  const chainPort: jest.Mocked<MarketplaceCanonicalBlockchainPort> = {
    cancelOrder: jest.fn().mockResolvedValue({
      transaction: { id: 'tx-cancel-abc' },
    } as any),
  } as unknown as jest.Mocked<MarketplaceCanonicalBlockchainPort>;

  const logger = {
    setContext: jest.fn(),
    debug: jest.fn(),
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  } as any;

  return { orderRepo, offerCounters, chainPort, logger };
}

describe('MarketplaceOrderCancelService', () => {
  let mocks: ReturnType<typeof buildMocks>;
  let service: MarketplaceOrderCancelService;

  beforeEach(() => {
    mocks = buildMocks();
    service = new MarketplaceOrderCancelService(
      mocks.orderRepo,
      mocks.offerCounters,
      mocks.chainPort,
      mocks.logger
    );
  });

  it('happy path — chain.cancelOrder + counter unblk + applyStatusTransition CANCELLED_BY_ORDERER', async () => {
    mocks.orderRepo.findById.mockResolvedValue(buildOrder());

    const result = await service.execute({
      coopname: 'voskhod',
      orderer_account: 'orderer1',
      order_id: 'order-1',
    });

    expect(mocks.chainPort.cancelOrder).toHaveBeenCalledWith({
      coopname: 'voskhod',
      orderer: 'orderer1',
      order_hash: 'h-order-1',
    });
    expect(mocks.offerCounters.onOrderUnblocked).toHaveBeenCalledWith('offer-1', 5);
    expect(mocks.orderRepo.applyStatusTransition).toHaveBeenCalledWith(
      'order-1',
      'CANCELLED_BY_ORDERER',
      'Отменён заказчиком'
    );
    expect(result.tx_hash).toBe('tx-cancel-abc');
    expect(result.order.status).toBe('CANCELLED_BY_ORDERER');
  });

  it('NotFoundException когда Order не найден', async () => {
    mocks.orderRepo.findById.mockResolvedValue(null);

    await expect(
      service.execute({ coopname: 'voskhod', orderer_account: 'orderer1', order_id: 'order-x' })
    ).rejects.toThrow(NotFoundException);
    expect(mocks.chainPort.cancelOrder).not.toHaveBeenCalled();
  });

  it('Forbidden когда Order другого кооператива', async () => {
    mocks.orderRepo.findById.mockResolvedValue(buildOrder({ coopname: 'other-coop' }));

    await expect(
      service.execute({ coopname: 'voskhod', orderer_account: 'orderer1', order_id: 'order-1' })
    ).rejects.toThrow(ForbiddenException);
    expect(mocks.chainPort.cancelOrder).not.toHaveBeenCalled();
  });

  it('Forbidden когда отменяет не заказчик-владелец', async () => {
    mocks.orderRepo.findById.mockResolvedValue(buildOrder({ orderer_account: 'other-orderer' }));

    await expect(
      service.execute({ coopname: 'voskhod', orderer_account: 'orderer1', order_id: 'order-1' })
    ).rejects.toThrow(ForbiddenException);
    expect(mocks.chainPort.cancelOrder).not.toHaveBeenCalled();
  });

  // После открытия акта выдачи (readyrecv) и далее отмена закрыта —
  // контракт её отвергнет; уже отменённый — тем более.
  it.each([
    'READY_TO_RECEIVE',
    'RECEIVED',
    'CANCELLED_BY_ORDERER',
  ] as const)('BadRequest когда status = %s (акт выдачи открыт / уже отменён)', async (status) => {
    mocks.orderRepo.findById.mockResolvedValue(buildOrder({ status }));

    await expect(
      service.execute({ coopname: 'voskhod', orderer_account: 'orderer1', order_id: 'order-1' })
    ).rejects.toThrow(BadRequestException);
    expect(mocks.chainPort.cancelOrder).not.toHaveBeenCalled();
  });

  // Отмена/отказ доступны до открытия акта выдачи. Граница бесплатно/удержание
  // 50% — на стороне контракта (до акцепта поставщиком vs после). Бэкенд лишь
  // не закрывает действие раньше времени; на выдаче отказ идёт в ACCEPTED_TO_COOP.
  it.each([
    'ACTIVE',
    'ACCEPTED_PENDING_SUPPLIER',
    'ACCEPTED_PENDING_SUPPLIER_INDIVIDUAL',
    'ACCEPTED',
    'SUPPLY_PREPARED',
    'ACCEPTED_TO_COOP',
  ] as const)('cancel доступен в статусе %s', async (status) => {
    mocks.orderRepo.findById.mockResolvedValue(buildOrder({ status }));
    mocks.chainPort.cancelOrder.mockResolvedValue({ transaction: { id: 'tx-cancel-abc' } } as any);
    mocks.orderRepo.applyStatusTransition.mockResolvedValue(buildOrder({ status: 'CANCELLED_BY_ORDERER' }));

    await service.execute({ coopname: 'voskhod', orderer_account: 'orderer1', order_id: 'order-1' });

    expect(mocks.chainPort.cancelOrder).toHaveBeenCalled();
    expect(mocks.orderRepo.applyStatusTransition).toHaveBeenCalledWith(
      'order-1',
      'CANCELLED_BY_ORDERER',
      expect.any(String)
    );
  });

  it('chain.cancelOrder fail — clean BadRequestException, Order не модифицирован', async () => {
    mocks.orderRepo.findById.mockResolvedValue(buildOrder());
    mocks.chainPort.cancelOrder.mockRejectedValue(
      new Error('eosio_assert_message_exception: assertion failure with message: Вы не заказчик этого заказа')
    );

    await expect(
      service.execute({ coopname: 'voskhod', orderer_account: 'orderer1', order_id: 'order-1' })
    ).rejects.toThrow(/Вы не заказчик этого заказа/);
    expect(mocks.offerCounters.onOrderUnblocked).not.toHaveBeenCalled();
    expect(mocks.orderRepo.applyStatusTransition).not.toHaveBeenCalled();
  });

  it('counter onOrderUnblocked упал — applyStatusTransition всё равно вызывается (on-chain unblk прошёл)', async () => {
    mocks.orderRepo.findById.mockResolvedValue(buildOrder());
    mocks.offerCounters.onOrderUnblocked.mockRejectedValue(new Error('Offer уже неактивен'));

    await service.execute({
      coopname: 'voskhod',
      orderer_account: 'orderer1',
      order_id: 'order-1',
    });

    expect(mocks.chainPort.cancelOrder).toHaveBeenCalled();
    expect(mocks.orderRepo.applyStatusTransition).toHaveBeenCalledWith(
      'order-1',
      'CANCELLED_BY_ORDERER',
      'Отменён заказчиком'
    );
    expect(mocks.logger.warn).toHaveBeenCalled();
  });
});
