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
    delivery_braname: 'krasnogorsk',
    quantity: 5,
    price_per_unit: '150.0000',
    total_cost: '750.0000',
    cycle_id: null,
    status: 'ACTIVE',
    blocked_at: new Date('2026-05-01T00:00:00Z'),
    created_at: new Date('2026-05-01T00:00:00Z'),
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

  // batch-accept оборачивает принятые заказы в ОДНУ партию-накопитель (cycle)
  // в статусе ACCEPTED — best-effort; партию поставщик формирует явно отдельным
  // шагом (Эпик 14), shipment-create здесь не вызывается.
  const cycleRepo: jest.Mocked<MarketplaceConsolidatedRequestDomainRepository> = {
    create: jest.fn().mockResolvedValue({ id: 'cycle-1' } as any),
  } as unknown as jest.Mocked<MarketplaceConsolidatedRequestDomainRepository>;

  // Имя товара для уведомления заказчику об отказе тянется батчем по offer_id.
  const offerRepo = {
    findByIds: jest.fn().mockResolvedValue([{ id: 'offer-1', product_name: 'Молоко' }] as any),
  } as any;

  const offerCounters: jest.Mocked<MarketplaceOfferCountersService> = {
    onOrderUnblocked: jest.fn().mockResolvedValue({} as any),
  } as unknown as jest.Mocked<MarketplaceOfferCountersService>;

  const chainPort: jest.Mocked<MarketplaceCanonicalBlockchainPort> = {
    acceptOrder: jest.fn().mockResolvedValue({ transaction: { id: 'tx-acc-1' } } as any),
    declineOrder: jest.fn().mockResolvedValue({ transaction: { id: 'tx-dec-1' } } as any),
  } as unknown as jest.Mocked<MarketplaceCanonicalBlockchainPort>;

  // Шина событий: отказ эмитит уведомление заказчику (best-effort, не критично).
  const eventBus = { emit: jest.fn() } as any;

  const logger = {
    setContext: jest.fn(),
    debug: jest.fn(),
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  } as any;

  return { orderRepo, cycleRepo, offerRepo, offerCounters, chainPort, eventBus, logger };
}

describe('MarketplaceOrderSupplierActionService (Эпик 15 — batch)', () => {
  let mocks: ReturnType<typeof buildMocks>;
  let service: MarketplaceOrderSupplierActionService;

  beforeEach(() => {
    mocks = buildMocks();
    service = new MarketplaceOrderSupplierActionService(
      mocks.orderRepo,
      mocks.cycleRepo,
      mocks.offerRepo,
      mocks.offerCounters,
      mocks.chainPort,
      mocks.eventBus,
      mocks.logger
    );
  });

  describe('acceptOrdersBatch', () => {
    it('happy path — acceptOrder per заказ + ACCEPTED + одна партия из всех', async () => {
      mocks.orderRepo.findById
        .mockResolvedValueOnce(buildOrder({ id: 'order-1', order_hash: 'h1' }))
        .mockResolvedValueOnce(buildOrder({ id: 'order-2', order_hash: 'h2' }))
        // findById внутри synthesizeBatchCycle (refresh) — по два заказа
        .mockResolvedValue(buildOrder({ status: 'ACCEPTED' as any }));

      const result = await service.acceptOrdersBatch({
        coopname: 'voskhod',
        offerer_account: 'supplier1',
        order_ids: ['order-1', 'order-2'],
      });

      expect(mocks.chainPort.acceptOrder).toHaveBeenCalledTimes(2);
      expect(mocks.orderRepo.applyStatusTransition).toHaveBeenCalledWith(
        'order-1',
        'ACCEPTED',
        'Принят поставщиком к поставке'
      );
      // Все принятые заказы обёрнуты в ОДНУ партию.
      expect(mocks.cycleRepo.create).toHaveBeenCalledTimes(1);
      expect(mocks.orderRepo.assignToCycle).toHaveBeenCalledWith(['order-1', 'order-2'], 'cycle-1', 'ACCEPTED');
      expect(result.cycle_id).toBe('cycle-1');
      expect(result.tx_hashes).toHaveLength(2);
    });

    it('BadRequest — пустой список заказов', async () => {
      await expect(
        service.acceptOrdersBatch({ coopname: 'voskhod', offerer_account: 'supplier1', order_ids: [] })
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('NotFound — заказ не найден', async () => {
      mocks.orderRepo.findById.mockResolvedValue(null);
      await expect(
        service.acceptOrdersBatch({ coopname: 'voskhod', offerer_account: 'supplier1', order_ids: ['missing'] })
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('Forbidden — не владелец Offer\'а', async () => {
      mocks.orderRepo.findById.mockResolvedValue(buildOrder({ supplier_account: 'someone-else' }));
      await expect(
        service.acceptOrdersBatch({ coopname: 'voskhod', offerer_account: 'supplier1', order_ids: ['order-1'] })
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it.each(['ACCEPTED', 'CANCELLED_BY_ORDERER'] as const)(
      'BadRequest для status=%s (не активен)',
      async (status) => {
        mocks.orderRepo.findById.mockResolvedValue(buildOrder({ status } as any));
        await expect(
          service.acceptOrdersBatch({ coopname: 'voskhod', offerer_account: 'supplier1', order_ids: ['order-1'] })
        ).rejects.toBeInstanceOf(BadRequestException);
      }
    );

    it('BadRequest — заказ уже присоединён к партии (cycle_id != null)', async () => {
      mocks.orderRepo.findById.mockResolvedValue(buildOrder({ cycle_id: 'cycle-x' }));
      await expect(
        service.acceptOrdersBatch({ coopname: 'voskhod', offerer_account: 'supplier1', order_ids: ['order-1'] })
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('chain fail на единственном заказе → ни одного принятого → BadRequest', async () => {
      mocks.orderRepo.findById.mockResolvedValue(buildOrder());
      mocks.chainPort.acceptOrder.mockRejectedValue(new Error('chain timeout'));
      await expect(
        service.acceptOrdersBatch({ coopname: 'voskhod', offerer_account: 'supplier1', order_ids: ['order-1'] })
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('ни один заказ не прошёл цепь → отказ целиком, партия не создаётся', async () => {
      mocks.orderRepo.findById
        .mockResolvedValueOnce(buildOrder({ id: 'order-1', order_hash: 'h1' }))
        .mockResolvedValueOnce(buildOrder({ id: 'order-2', order_hash: 'h2' }));
      mocks.chainPort.acceptOrder.mockRejectedValue(new Error('chain timeout'));

      await expect(
        service.acceptOrdersBatch({
          coopname: 'voskhod',
          offerer_account: 'supplier1',
          order_ids: ['order-1', 'order-2'],
        })
      ).rejects.toThrow('Не удалось принять ни одного заказа');

      // Ни статуса, ни партии: у поставщика после отказа состояние не поехало.
      expect(mocks.orderRepo.applyStatusTransition).not.toHaveBeenCalled();
      expect(mocks.cycleRepo.create).not.toHaveBeenCalled();
    });

    /**
     * Непроходной заказ в середине списка обязан остановить операцию ДО первого
     * обращения к цепи. Раньше проверки жили внутри цикла приёма: заказы до
     * непроходного уже уходили on-chain и переводились в ACCEPTED, а поставщик
     * получал 400 — и не знал, что часть заказов принята.
     */
    describe('частичного эффекта нет: проверки идут до цепи', () => {
      it('непроходной по статусу заказ вторым — цепь не вызывается ни разу', async () => {
        mocks.orderRepo.findById
          .mockResolvedValueOnce(buildOrder({ id: 'order-1', order_hash: 'h1' }))
          .mockResolvedValueOnce(buildOrder({ id: 'order-2', status: 'ACCEPTED' as any }));

        await expect(
          service.acceptOrdersBatch({
            coopname: 'voskhod',
            offerer_account: 'supplier1',
            order_ids: ['order-1', 'order-2'],
          })
        ).rejects.toBeInstanceOf(BadRequestException);

        expect(mocks.chainPort.acceptOrder).not.toHaveBeenCalled();
        expect(mocks.orderRepo.applyStatusTransition).not.toHaveBeenCalled();
        expect(mocks.cycleRepo.create).not.toHaveBeenCalled();
      });

      it('чужой заказ вторым — цепь не вызывается ни разу', async () => {
        mocks.orderRepo.findById
          .mockResolvedValueOnce(buildOrder({ id: 'order-1', order_hash: 'h1' }))
          .mockResolvedValueOnce(buildOrder({ id: 'order-2', supplier_account: 'someone-else' }));

        await expect(
          service.acceptOrdersBatch({
            coopname: 'voskhod',
            offerer_account: 'supplier1',
            order_ids: ['order-1', 'order-2'],
          })
        ).rejects.toBeInstanceOf(ForbiddenException);

        expect(mocks.chainPort.acceptOrder).not.toHaveBeenCalled();
        expect(mocks.orderRepo.applyStatusTransition).not.toHaveBeenCalled();
      });

      it('заказ, которого нет, вторым — цепь не вызывается ни разу', async () => {
        mocks.orderRepo.findById
          .mockResolvedValueOnce(buildOrder({ id: 'order-1', order_hash: 'h1' }))
          .mockResolvedValueOnce(null);

        await expect(
          service.acceptOrdersBatch({
            coopname: 'voskhod',
            offerer_account: 'supplier1',
            order_ids: ['order-1', 'missing'],
          })
        ).rejects.toBeInstanceOf(NotFoundException);

        expect(mocks.chainPort.acceptOrder).not.toHaveBeenCalled();
      });
    });
  });

  describe('declineOrdersBatch', () => {
    it('happy path — declineOrder + counter unblk + CANCELLED_BY_SUPPLIER', async () => {
      mocks.orderRepo.findById.mockResolvedValue(buildOrder({ quantity: 7 }));

      const result = await service.declineOrdersBatch({
        coopname: 'voskhod',
        offerer_account: 'supplier1',
        order_ids: ['order-1'],
        reason: 'нет ресурса',
      });

      expect(mocks.chainPort.declineOrder).toHaveBeenCalledTimes(1);
      expect(mocks.offerCounters.onOrderUnblocked).toHaveBeenCalledWith('offer-1', 7);
      expect(mocks.orderRepo.applyStatusTransition).toHaveBeenCalledWith('order-1', 'CANCELLED_BY_SUPPLIER', 'нет ресурса');
      expect(result.cycle_id).toBeNull();
      expect(result.tx_hashes).toEqual(['tx-dec-1']);
    });

    it('BadRequest — пустой reason', async () => {
      await expect(
        service.declineOrdersBatch({ coopname: 'voskhod', offerer_account: 'supplier1', order_ids: ['order-1'], reason: '' })
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(mocks.orderRepo.findById).not.toHaveBeenCalled();
    });

    it('BadRequest — статус не ACTIVE', async () => {
      mocks.orderRepo.findById.mockResolvedValue(buildOrder({ status: 'ACCEPTED' as any }));
      await expect(
        service.declineOrdersBatch({ coopname: 'voskhod', offerer_account: 'supplier1', order_ids: ['order-1'], reason: 'x' })
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('chain fail → BadRequest, counter не дёргается', async () => {
      mocks.orderRepo.findById.mockResolvedValue(buildOrder());
      mocks.chainPort.declineOrder.mockRejectedValue(new Error('chain timeout'));
      await expect(
        service.declineOrdersBatch({ coopname: 'voskhod', offerer_account: 'supplier1', order_ids: ['order-1'], reason: 'x' })
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(mocks.offerCounters.onOrderUnblocked).not.toHaveBeenCalled();
    });

    it('непроходной заказ вторым — ни один отказ не уходит в цепь', async () => {
      mocks.orderRepo.findById
        .mockResolvedValueOnce(buildOrder({ id: 'order-1', order_hash: 'h1' }))
        .mockResolvedValueOnce(buildOrder({ id: 'order-2', cycle_id: 'cycle-x' }));

      await expect(
        service.declineOrdersBatch({
          coopname: 'voskhod',
          offerer_account: 'supplier1',
          order_ids: ['order-1', 'order-2'],
          reason: 'нет ресурса',
        })
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(mocks.chainPort.declineOrder).not.toHaveBeenCalled();
      expect(mocks.orderRepo.applyStatusTransition).not.toHaveBeenCalled();
    });
  });
});
