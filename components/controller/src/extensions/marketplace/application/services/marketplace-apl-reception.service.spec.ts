import { ConflictException } from '@nestjs/common';
import { MarketplaceAplReceptionService } from './marketplace-apl-reception.service';
import { MarketplaceAplReceptionDomainEntity } from '../../domain/entities/marketplace-apl-reception.entity';
import {
  MarketplaceAplReceptionStatuses,
  MarketplaceAplReceptionVariants,
} from '../../domain/entities/marketplace-apl-reception.types';
import type { MarketplaceOrderDomainEntity } from '../../domain/entities/marketplace-order.entity';
import type { MarketplaceShipmentDomainRepository } from '../../domain/repositories/marketplace-shipment.repository';
import type { MarketplaceOrderDomainRepository } from '../../domain/repositories/marketplace-order.repository';
import type { MarketplaceAplReceptionDomainRepository } from '../../domain/repositories/marketplace-apl-reception.repository';
import type { MarketplaceOutgoingPaymentRequestDomainRepository } from '../../domain/repositories/marketplace-outgoing-payment-request.repository';
import type { MarketplaceOfferCountersService } from './marketplace-offer-counters.service';
import type { MarketplaceCanonicalBlockchainPort } from '../../domain/ports/marketplace-canonical-blockchain.port';
import type { GatewayInteractorPort } from '~/domain/wallet/ports/gateway-interactor.port';
import type { DocumentDomainService } from '~/domain/document/services/document-domain.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

function buildOrder(overrides: Partial<MarketplaceOrderDomainEntity> = {}): MarketplaceOrderDomainEntity {
  return {
    id: 'order-1',
    coopname: 'voskhod',
    orderer_account: 'pai1',
    offer_id: 'offer-1',
    cycle_id: 'cycle-1',
    delivery_braname: 'ku.krasn.1',
    order_hash: '0xorder1hash',
    quantity: 2,
    unit_of_measure: 'piece',
    package_size: 0,
    price_per_unit: '150.0000',
    total_cost: '300.0000',
    status: 'BLOCKED',
    ...overrides,
  } as unknown as MarketplaceOrderDomainEntity;
}

function buildReception(
  overrides: Partial<MarketplaceAplReceptionDomainEntity> = {}
): MarketplaceAplReceptionDomainEntity {
  const reception = new MarketplaceAplReceptionDomainEntity({
    id: 'apl-1',
    coopname: 'voskhod',
    shipment_id: 'ship-1',
    cycle_id: 'cycle-1',
    braname: 'ku.krasn.1',
    offerer_account: 'supplier1',
    variant: MarketplaceAplReceptionVariants.IN_PERSON,
    status: MarketplaceAplReceptionStatuses.PENDING_SUPPLIER_SIGN,
    fact_quantity_per_order: [{ order_id: 'order-1', fact_quantity: 2 }],
    ttn_number: null,
    expeditor_data: null,
    created_by_operator_account: 'operator1',
    supplier_signed_at: null,
    supplier_signsupp_tx_hash: null,
    supplier_signed_documents: null,
    chairman_signed_at: null,
    chairman_account: null,
    chairman_signchair_tx_hash: null,
    total_amount: '300.0000',
    created_at: new Date('2026-05-19T00:00:00Z'),
    updated_at: new Date('2026-05-19T00:00:00Z'),
  });
  for (const k of Object.keys(overrides)) {
    (reception as any)[k] = (overrides as any)[k];
  }
  return reception;
}

function buildMocks() {
  const shipmentRepo = {
    findById: jest.fn(),
    applyStatusTransition: jest.fn(),
  } as unknown as jest.Mocked<MarketplaceShipmentDomainRepository>;

  const orderRepo = {
    findByCycleId: jest.fn(),
    applyStatusTransition: jest.fn(),
  } as unknown as jest.Mocked<MarketplaceOrderDomainRepository>;

  const receptionRepo = {
    findById: jest.fn(),
    findByShipmentId: jest.fn(),
    create: jest.fn(),
    applySignatures: jest.fn(),
  } as unknown as jest.Mocked<MarketplaceAplReceptionDomainRepository>;

  const counters = {
    onOrderBlocked: jest.fn(),
    onOrderConsumed: jest.fn(),
    onOrderRolledBack: jest.fn(),
  } as unknown as jest.Mocked<MarketplaceOfferCountersService>;

  const chainPort = {
    signSupp: jest.fn(),
    signChair: jest.fn(),
    payOut: jest.fn(),
  } as unknown as jest.Mocked<MarketplaceCanonicalBlockchainPort>;

  const paymentRepo = {
    findByOrderId: jest.fn(),
    createPending: jest.fn(),
  } as unknown as jest.Mocked<MarketplaceOutgoingPaymentRequestDomainRepository>;

  const offerRepo = {
    findByIds: jest.fn().mockResolvedValue([]),
    findById: jest.fn().mockResolvedValue(null),
  } as any;

  const inventoryRepo = {
    countByOrder: jest.fn().mockResolvedValue(0),
    create: jest.fn().mockResolvedValue({}),
  } as any;

  const coreGateway = {
    createSystemOutgoingPayment: jest.fn(),
    setPaymentStatus: jest.fn(),
  } as unknown as jest.Mocked<GatewayInteractorPort>;

  const documentDomainService = {
    generateDocument: jest.fn(),
  } as unknown as jest.Mocked<DocumentDomainService>;

  const supplierSettings = {
    resolvePayoutMethod: jest.fn().mockResolvedValue(null),
  } as any;

  // Реквизиты договора поставщика для назначения платежа в initiatePayouts
  // (см. MarketplaceSupplierRegistryService.findByMember). По умолчанию —
  // «нет записи»: buildPayoutPurpose падает на fallback-текст без реквизитов.
  const supplierRegistry = {
    findByMember: jest.fn().mockResolvedValue(null),
  } as any;

  const supplierActionService = {
    declineOrdersAtReception: jest.fn().mockResolvedValue([]),
  } as any;

  const logger = {
    setContext: jest.fn(),
    debug: jest.fn(),
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  } as any;

  const eventBus = {
    emit: jest.fn(),
  } as unknown as jest.Mocked<EventEmitter2>;

  return {
    shipmentRepo,
    orderRepo,
    receptionRepo,
    counters,
    chainPort,
    paymentRepo,
    offerRepo,
    inventoryRepo,
    coreGateway,
    supplierSettings,
    supplierRegistry,
    supplierActionService,
    documentDomainService,
    eventBus,
    logger,
  };
}

function buildService(mocks: ReturnType<typeof buildMocks>): MarketplaceAplReceptionService {
  const service = new MarketplaceAplReceptionService(
    mocks.shipmentRepo,
    mocks.orderRepo,
    mocks.receptionRepo,
    mocks.counters,
    mocks.chainPort,
    mocks.paymentRepo,
    mocks.offerRepo,
    mocks.inventoryRepo,
    // Эпик 19 (адресное хранение): боксы, координатные ячейки и настройки
    // склада. В сценариях этого спека адресное хранение выключено, поэтому
    // достаточно заглушек — но пропускать аргументы нельзя, спек перестаёт
    // компилироваться (именно так он и был сломан).
    { findByCoop: jest.fn(), findById: jest.fn() } as never,
    { findByContainer: jest.fn(), findById: jest.fn() } as never,
    {
      // Адресное хранение выключено: боксов и ячеек в кооперативе нет,
      // приёмка кладёт имущество без адреса.
      get: jest.fn().mockResolvedValue({ containers_enabled: false, cells_enabled: false }),
    } as never,
    { symbol: 'RUB', decimals: 4 },
    mocks.coreGateway,
    mocks.supplierSettings,
    mocks.supplierRegistry,
    mocks.supplierActionService,
    mocks.documentDomainService,
    mocks.eventBus,
    mocks.logger
  );
  // Подпись клиента в jest-spec'е не верифицируем: цель тестов — поведение
  // compensating-rollback после chainPort.* throws, а не PublicKey.verify.
  jest.spyOn(service as any, 'verifyDocumentSignature').mockImplementation(() => undefined);
  return service;
}

function buildSignedDocs(orderIds: string[]): any[] {
  return orderIds.map((orderId) => ({
    meta: { order_id: orderId },
    signatures: [{ public_key: 'EOSpub', signature: 'SIGstub', signed_hash: 'hash' }],
    toDocument: () => ({ stub_act: true, order_id: orderId }),
  }));
}

describe('MarketplaceAplReceptionService — FR45 AC5 compensating-rollback', () => {
  let mocks: ReturnType<typeof buildMocks>;
  let service: MarketplaceAplReceptionService;

  beforeEach(() => {
    mocks = buildMocks();
    service = buildService(mocks);
  });

  describe('signAsSupplier: chainPort.signSupp throws', () => {
    it('бросает ConflictException и НЕ дергает receptionRepo.applySignatures', async () => {
      const reception = buildReception();
      const order = buildOrder({ id: 'order-1', order_hash: '0xorder1hash' });

      mocks.receptionRepo.findById.mockResolvedValue(reception);
      mocks.orderRepo.findByCycleId.mockResolvedValue([order]);
      (mocks.chainPort.signSupp as jest.Mock).mockRejectedValue(new Error('chain RPC timeout'));

      await expect(
        service.signAsSupplier({
          coopname: 'voskhod',
          supplier_account: 'supplier1',
          apl_reception_id: 'apl-1',
          signed_documents: buildSignedDocs(['order-1']),
        })
      ).rejects.toThrow(ConflictException);

      expect(mocks.chainPort.signSupp).toHaveBeenCalledTimes(1);
      expect(mocks.receptionRepo.applySignatures).not.toHaveBeenCalled();
      // Status объекта в памяти НЕ был перетёрт сервисом.
      expect(reception.status).toBe(MarketplaceAplReceptionStatuses.PENDING_SUPPLIER_SIGN);
    });

    it('повторная подпись после failure идемпотентна: повторно отправляет signsupp и при успехе ставит PENDING_CHAIRMAN_RECEPTION_SIGN', async () => {
      const reception = buildReception();
      const order = buildOrder({ id: 'order-1' });

      mocks.receptionRepo.findById.mockResolvedValue(reception);
      mocks.orderRepo.findByCycleId.mockResolvedValue([order]);
      (mocks.chainPort.signSupp as jest.Mock)
        .mockRejectedValueOnce(new Error('chain RPC timeout'))
        .mockResolvedValueOnce({ response: { transaction_id: 'tx-supplier-2' } });

      mocks.receptionRepo.applySignatures.mockImplementation(async (_id, patch) => {
        Object.assign(reception, patch);
        return reception;
      });

      await expect(
        service.signAsSupplier({
          coopname: 'voskhod',
          supplier_account: 'supplier1',
          apl_reception_id: 'apl-1',
          signed_documents: buildSignedDocs(['order-1']),
        })
      ).rejects.toThrow(ConflictException);

      const result = await service.signAsSupplier({
        coopname: 'voskhod',
        supplier_account: 'supplier1',
        apl_reception_id: 'apl-1',
        signed_documents: buildSignedDocs(['order-1']),
      });

      expect(mocks.chainPort.signSupp).toHaveBeenCalledTimes(2);
      expect(mocks.receptionRepo.applySignatures).toHaveBeenCalledTimes(1);
      const patch = mocks.receptionRepo.applySignatures.mock.calls[0][1] as any;
      expect(patch.status).toBe(MarketplaceAplReceptionStatuses.PENDING_CHAIRMAN_RECEPTION_SIGN);
      expect(patch.supplier_signsupp_tx_hash).toBe('tx-supplier-2');
      expect(result.apl_reception.status).toBe(MarketplaceAplReceptionStatuses.PENDING_CHAIRMAN_RECEPTION_SIGN);
    });
  });

  describe('signAsChairman: chainPort.signChair throws', () => {
    it('бросает ConflictException и НЕ дергает receptionRepo.applySignatures', async () => {
      const reception = buildReception({
        status: MarketplaceAplReceptionStatuses.PENDING_CHAIRMAN_RECEPTION_SIGN,
        supplier_signed_at: new Date('2026-05-19T01:00:00Z'),
        supplier_signsupp_tx_hash: 'tx-supplier-ok',
      });
      const order = buildOrder({ id: 'order-1', order_hash: '0xorder1hash' });

      mocks.receptionRepo.findById.mockResolvedValue(reception);
      mocks.orderRepo.findByCycleId.mockResolvedValue([order]);
      (mocks.chainPort.signChair as jest.Mock).mockRejectedValue(new Error('chain insufficient_funds'));

      await expect(
        service.signAsChairman({
          coopname: 'voskhod',
          chairman_account: 'chair1',
          apl_reception_id: 'apl-1',
          signed_documents: buildSignedDocs(['order-1']),
        })
      ).rejects.toThrow(ConflictException);

      expect(mocks.chainPort.signChair).toHaveBeenCalledTimes(1);
      expect(mocks.receptionRepo.applySignatures).not.toHaveBeenCalled();
      expect(mocks.orderRepo.applyStatusTransition).not.toHaveBeenCalled();
      expect(mocks.shipmentRepo.applyStatusTransition).not.toHaveBeenCalled();
      expect(reception.status).toBe(MarketplaceAplReceptionStatuses.PENDING_CHAIRMAN_RECEPTION_SIGN);
    });

    it('повторная подпись после failure идемпотентна: ставит ACCEPTED_TO_COOP, продвигает Order и Shipment', async () => {
      const reception = buildReception({
        status: MarketplaceAplReceptionStatuses.PENDING_CHAIRMAN_RECEPTION_SIGN,
        supplier_signed_at: new Date('2026-05-19T01:00:00Z'),
        supplier_signsupp_tx_hash: 'tx-supplier-ok',
      });
      const order = buildOrder({ id: 'order-1', delivery_braname: 'ku.krasn.1' });

      mocks.receptionRepo.findById.mockResolvedValue(reception);
      mocks.orderRepo.findByCycleId.mockResolvedValue([order]);
      (mocks.chainPort.signChair as jest.Mock)
        .mockRejectedValueOnce(new Error('chain insufficient_funds'))
        .mockResolvedValueOnce({ response: { transaction_id: 'tx-chair-2' } });

      mocks.receptionRepo.applySignatures.mockImplementation(async (_id, patch) => {
        Object.assign(reception, patch);
        return reception;
      });

      await expect(
        service.signAsChairman({
          coopname: 'voskhod',
          chairman_account: 'chair1',
          apl_reception_id: 'apl-1',
          signed_documents: buildSignedDocs(['order-1']),
        })
      ).rejects.toThrow(ConflictException);

      const result = await service.signAsChairman({
        coopname: 'voskhod',
        chairman_account: 'chair1',
        apl_reception_id: 'apl-1',
        signed_documents: buildSignedDocs(['order-1']),
      });

      expect(mocks.chainPort.signChair).toHaveBeenCalledTimes(2);
      expect(mocks.receptionRepo.applySignatures).toHaveBeenCalledTimes(1);
      const patch = mocks.receptionRepo.applySignatures.mock.calls[0][1] as any;
      expect(patch.status).toBe(MarketplaceAplReceptionStatuses.ACCEPTED_TO_COOP);
      expect(patch.chairman_account).toBe('chair1');
      expect(patch.chairman_signchair_tx_hash).toBe('tx-chair-2');

      expect(mocks.orderRepo.applyStatusTransition).toHaveBeenCalledWith(
        'order-1',
        'ACCEPTED_TO_COOP',
        expect.any(String)
      );
      expect(mocks.shipmentRepo.applyStatusTransition).toHaveBeenCalledWith(
        'ship-1',
        'ACCEPTED_TO_COOP'
      );
      expect(result.apl_reception.status).toBe(MarketplaceAplReceptionStatuses.ACCEPTED_TO_COOP);
    });
  });

  describe('гард: подпись в неверном статусе', () => {
    it('signAsSupplier на не-PENDING_SUPPLIER_SIGN → ConflictException без обращения к chainPort', async () => {
      const reception = buildReception({
        status: MarketplaceAplReceptionStatuses.ACCEPTED_TO_COOP,
      });
      mocks.receptionRepo.findById.mockResolvedValue(reception);

      await expect(
        service.signAsSupplier({
          coopname: 'voskhod',
          supplier_account: 'supplier1',
          apl_reception_id: 'apl-1',
          signed_documents: buildSignedDocs(['order-1']),
        })
      ).rejects.toThrow(ConflictException);

      expect(mocks.chainPort.signSupp).not.toHaveBeenCalled();
      expect(mocks.receptionRepo.applySignatures).not.toHaveBeenCalled();
    });

    it('signAsChairman на не-PENDING_CHAIRMAN_RECEPTION_SIGN → ConflictException без обращения к chainPort', async () => {
      const reception = buildReception({
        status: MarketplaceAplReceptionStatuses.PENDING_SUPPLIER_SIGN,
      });
      mocks.receptionRepo.findById.mockResolvedValue(reception);

      await expect(
        service.signAsChairman({
          coopname: 'voskhod',
          chairman_account: 'chair1',
          apl_reception_id: 'apl-1',
          signed_documents: buildSignedDocs(['order-1']),
        })
      ).rejects.toThrow(ConflictException);

      expect(mocks.chainPort.signChair).not.toHaveBeenCalled();
      expect(mocks.receptionRepo.applySignatures).not.toHaveBeenCalled();
    });
  });

  describe('отказ в приёмке (некондиция): разнос принято/отклонено', () => {
    it('signAsSupplier: позиция с факт=0 уходит в declineOrdersAtReception, signsupp только по принятой, статус → PENDING_CHAIRMAN', async () => {
      const reception = buildReception({
        fact_quantity_per_order: [
          { order_id: 'order-1', fact_quantity: 2 }, // принято
          { order_id: 'order-2', fact_quantity: 0 }, // снято оператором (некондиция)
        ],
      });
      const accepted = buildOrder({ id: 'order-1', order_hash: '0xorder1hash' });
      const rejected = buildOrder({ id: 'order-2', order_hash: '0xorder2hash' });

      mocks.receptionRepo.findById.mockResolvedValue(reception);
      mocks.orderRepo.findByCycleId.mockResolvedValue([accepted, rejected]);
      (mocks.chainPort.signSupp as jest.Mock).mockResolvedValue({
        response: { transaction_id: 'tx-supplier-ok' },
      });
      mocks.receptionRepo.applySignatures.mockImplementation(async (_id, patch) => {
        Object.assign(reception, patch);
        return reception;
      });

      await service.signAsSupplier({
        coopname: 'voskhod',
        supplier_account: 'supplier1',
        apl_reception_id: 'apl-1',
        signed_documents: buildSignedDocs(['order-1']),
      });

      // signsupp — только по принятой позиции (одна).
      expect(mocks.chainPort.signSupp).toHaveBeenCalledTimes(1);
      // Снятая позиция ушла в отказ приёмки (полный возврат заказчику).
      expect(mocks.supplierActionService.declineOrdersAtReception).toHaveBeenCalledTimes(1);
      const declineArg = mocks.supplierActionService.declineOrdersAtReception.mock.calls[0][0];
      expect(declineArg.orders.map((o: any) => o.id)).toEqual(['order-2']);
      // Акт уходит председателю на закрывающую подпись.
      const patch = mocks.receptionRepo.applySignatures.mock.calls[0][1] as any;
      expect(patch.status).toBe(MarketplaceAplReceptionStatuses.PENDING_CHAIRMAN_RECEPTION_SIGN);
    });

    it('signAsSupplier: вся партия некондиция (все факт=0) → нет signsupp, отказ всех, приёмка CANCELLED + shipment CANCELLED', async () => {
      const reception = buildReception({
        fact_quantity_per_order: [
          { order_id: 'order-1', fact_quantity: 0 },
          { order_id: 'order-2', fact_quantity: 0 },
        ],
      });
      const o1 = buildOrder({ id: 'order-1', order_hash: '0xorder1hash' });
      const o2 = buildOrder({ id: 'order-2', order_hash: '0xorder2hash' });

      mocks.receptionRepo.findById.mockResolvedValue(reception);
      mocks.orderRepo.findByCycleId.mockResolvedValue([o1, o2]);
      mocks.receptionRepo.applySignatures.mockImplementation(async (_id, patch) => {
        Object.assign(reception, patch);
        return reception;
      });

      const result = await service.signAsSupplier({
        coopname: 'voskhod',
        supplier_account: 'supplier1',
        apl_reception_id: 'apl-1',
        signed_documents: [],
      });

      expect(mocks.chainPort.signSupp).not.toHaveBeenCalled();
      const declineArg = mocks.supplierActionService.declineOrdersAtReception.mock.calls[0][0];
      expect(declineArg.orders.map((o: any) => o.id).sort()).toEqual(['order-1', 'order-2']);
      const patch = mocks.receptionRepo.applySignatures.mock.calls[0][1] as any;
      expect(patch.status).toBe(MarketplaceAplReceptionStatuses.CANCELLED);
      expect(mocks.shipmentRepo.applyStatusTransition).toHaveBeenCalledWith('ship-1', 'CANCELLED');
      expect(result.apl_reception.status).toBe(MarketplaceAplReceptionStatuses.CANCELLED);
    });

    it('signAsChairman: отклонённую в приёмке позицию (факт=0) НЕ подписывает и НЕ продвигает в ACCEPTED_TO_COOP', async () => {
      const reception = buildReception({
        status: MarketplaceAplReceptionStatuses.PENDING_CHAIRMAN_RECEPTION_SIGN,
        supplier_signed_at: new Date('2026-05-19T01:00:00Z'),
        supplier_signsupp_tx_hash: 'tx-supplier-ok',
        fact_quantity_per_order: [
          { order_id: 'order-1', fact_quantity: 2 }, // принято
          { order_id: 'order-2', fact_quantity: 0 }, // отклонено в приёмке
        ],
      });
      const accepted = buildOrder({ id: 'order-1', order_hash: '0xorder1hash' });
      // Отклонённая позиция в PG уже терминальна.
      const rejected = buildOrder({
        id: 'order-2',
        order_hash: '0xorder2hash',
        status: 'CANCELLED_BY_SUPPLIER',
      });

      mocks.receptionRepo.findById.mockResolvedValue(reception);
      mocks.orderRepo.findByCycleId.mockResolvedValue([accepted, rejected]);
      (mocks.chainPort.signChair as jest.Mock).mockResolvedValue({
        response: { transaction_id: 'tx-chair-ok' },
      });
      mocks.receptionRepo.applySignatures.mockImplementation(async (_id, patch) => {
        Object.assign(reception, patch);
        return reception;
      });

      await service.signAsChairman({
        coopname: 'voskhod',
        chairman_account: 'chair1',
        apl_reception_id: 'apl-1',
        signed_documents: buildSignedDocs(['order-1']),
      });

      // signchair — только по принятой позиции.
      expect(mocks.chainPort.signChair).toHaveBeenCalledTimes(1);
      // В ACCEPTED_TO_COOP продвигается только принятая, отклонённая — нет.
      expect(mocks.orderRepo.applyStatusTransition).toHaveBeenCalledTimes(1);
      expect(mocks.orderRepo.applyStatusTransition).toHaveBeenCalledWith(
        'order-1',
        'ACCEPTED_TO_COOP',
        expect.any(String)
      );
      expect(mocks.orderRepo.applyStatusTransition).not.toHaveBeenCalledWith(
        'order-2',
        'ACCEPTED_TO_COOP',
        expect.any(String)
      );
    });
  });

  describe('cancelReception: откат черновика приёмки (поставщик не согласен)', () => {
    it('на PENDING_SUPPLIER_SIGN → приёмка CANCELLED + партия назад в SUPPLY_PREPARED', async () => {
      const reception = buildReception({
        status: MarketplaceAplReceptionStatuses.PENDING_SUPPLIER_SIGN,
      });
      mocks.receptionRepo.findById.mockResolvedValue(reception);
      mocks.receptionRepo.applySignatures.mockImplementation(async (_id, patch) => {
        Object.assign(reception, patch);
        return reception;
      });

      const result = await service.cancelReception({
        coopname: 'voskhod',
        cancelled_by: 'operator1',
        apl_reception_id: 'apl-1',
      });

      const patch = mocks.receptionRepo.applySignatures.mock.calls[0][1] as any;
      expect(patch.status).toBe(MarketplaceAplReceptionStatuses.CANCELLED);
      expect(mocks.shipmentRepo.applyStatusTransition).toHaveBeenCalledWith('ship-1', 'SUPPLY_PREPARED');
      expect(result.apl_reception.status).toBe(MarketplaceAplReceptionStatuses.CANCELLED);
      // Откат оператором — без push «поставщик отменил».
      expect(mocks.eventBus.emit).not.toHaveBeenCalledWith(
        'marketplace.aplReception.operator.cancelledBySupplier',
        expect.anything()
      );
    });

    it('отмена поставщиком → emit уведомления оператору, сформировавшему акт', async () => {
      const reception = buildReception({
        status: MarketplaceAplReceptionStatuses.PENDING_SUPPLIER_SIGN,
        offerer_account: 'supplier1',
        created_by_operator_account: 'operator1',
      });
      mocks.receptionRepo.findById.mockResolvedValue(reception);
      mocks.receptionRepo.applySignatures.mockImplementation(async (_id, patch) => {
        Object.assign(reception, patch);
        return reception;
      });

      await service.cancelReception({
        coopname: 'voskhod',
        cancelled_by: 'supplier1',
        apl_reception_id: 'apl-1',
      });

      expect(mocks.eventBus.emit).toHaveBeenCalledWith(
        'marketplace.aplReception.operator.cancelledBySupplier',
        expect.objectContaining({
          apl_reception_id: 'apl-1',
          supplier_account: 'supplier1',
          operator_account: 'operator1',
          braname: 'ku.krasn.1',
        })
      );
    });

    it('после подписи поставщика (PENDING_CHAIRMAN) → ConflictException, ничего не меняется', async () => {
      const reception = buildReception({
        status: MarketplaceAplReceptionStatuses.PENDING_CHAIRMAN_RECEPTION_SIGN,
      });
      mocks.receptionRepo.findById.mockResolvedValue(reception);

      await expect(
        service.cancelReception({
          coopname: 'voskhod',
          cancelled_by: 'operator1',
          apl_reception_id: 'apl-1',
        })
      ).rejects.toThrow(ConflictException);

      expect(mocks.receptionRepo.applySignatures).not.toHaveBeenCalled();
      expect(mocks.shipmentRepo.applyStatusTransition).not.toHaveBeenCalled();
    });
  });

  /**
   * Одна партия — одна активная приёмка. Пересобрать акт можно только через
   * явную отмену черновика (кнопка «Отменить и пересобрать» на столе оператора,
   * видна лишь до подписи поставщика): отмена ставит приёмке CANCELLED, а
   * `findByShipmentId` отменённые не возвращает — и повторное формирование
   * проходит. Пока активная приёмка жива, второй акт по той же партии
   * создать нельзя.
   */
  describe('create: одна партия — одна активная приёмка', () => {
    const shipment = {
      id: 'ship-1',
      coopname: 'voskhod',
      cycle_id: 'cycle-1',
      braname: 'ku.krasn.1',
      status: 'SUPPLY_PREPARED',
    };

    it('по партии с активной приёмкой второй акт не формируется', async () => {
      mocks.shipmentRepo.findById.mockResolvedValue(shipment as never);
      mocks.receptionRepo.findByShipmentId.mockResolvedValue(buildReception());

      await expect(
        service.create({ coopname: 'voskhod', shipment_id: 'ship-1' } as never)
      ).rejects.toThrow(ConflictException);

      expect(mocks.receptionRepo.create).not.toHaveBeenCalled();
    });

    it('после отмены черновика партия свободна — акт формируется заново', async () => {
      mocks.shipmentRepo.findById.mockResolvedValue(shipment as never);
      // Отменённую приёмку findByShipmentId не отдаёт — партия снова свободна.
      mocks.receptionRepo.findByShipmentId.mockResolvedValue(null);
      (mocks.orderRepo as any).findByShipmentId = jest.fn().mockResolvedValue([]);
      mocks.orderRepo.findByCycleId.mockResolvedValue([]);

      // До состава партии дело дойдёт — значит блокировки «уже сформирована»
      // больше нет; на пустом составе сервис откажет уже по другой причине.
      await expect(
        service.create({ coopname: 'voskhod', shipment_id: 'ship-1' } as never)
      ).rejects.toThrow('нет Order');
    });
  });

  /**
   * Потолок приёмки — акцепт, то есть заказанное количество.
   *
   * Привезли меньше — принимаем недовоз, это штатная ситуация. Привезти больше
   * заказанного нельзя: лишнее имущество никем не оплачено и не заказано, а
   * акт приёма-передачи стал бы основанием для выплаты поставщику сверх
   * заказа. Партия и ТТН здесь не ограничитель — они лишь декларация.
   */
  describe('create: приёмка сверх заказанного', () => {
    const shipment = {
      id: 'ship-1',
      coopname: 'voskhod',
      cycle_id: 'cycle-1',
      braname: 'ku.krasn.1',
      status: 'SUPPLY_PREPARED',
    };

    function withOrder(quantity: number) {
      mocks.shipmentRepo.findById.mockResolvedValue(shipment as never);
      mocks.receptionRepo.findByShipmentId.mockResolvedValue(null);
      const order = buildOrder({ id: 'order-1', quantity });
      (mocks.orderRepo as any).findByShipmentId = jest.fn().mockResolvedValue([order]);
    }

    it('факт больше заказанного → отказ, акт не создаётся', async () => {
      withOrder(2);

      await expect(
        service.create({
          coopname: 'voskhod',
          shipment_id: 'ship-1',
          fact_quantity_per_order: [{ order_id: 'order-1', fact_quantity: 3 }],
        } as never)
      ).rejects.toThrow('Нельзя принять сверх акцепта');

      expect(mocks.receptionRepo.create).not.toHaveBeenCalled();
    });

    it('дробный или отрицательный факт → отказ', async () => {
      withOrder(5);

      for (const bad of [-1, 1.5]) {
        await expect(
          service.create({
            coopname: 'voskhod',
            shipment_id: 'ship-1',
            fact_quantity_per_order: [{ order_id: 'order-1', fact_quantity: bad }],
          } as never)
        ).rejects.toThrow('Некорректное fact_quantity');
      }

      expect(mocks.receptionRepo.create).not.toHaveBeenCalled();
    });

    it('недовоз проходит: факт меньше заказанного — не отказ', async () => {
      withOrder(5);

      // Дальше сценарий упрётся в заглушки документа; важно, что проверка
      // количества пропустила — недовоз это нормальный ход приёмки.
      const error = await service
        .create({
          coopname: 'voskhod',
          shipment_id: 'ship-1',
          fact_quantity_per_order: [{ order_id: 'order-1', fact_quantity: 3 }],
        } as never)
        .then(() => null)
        .catch((e: Error) => e);

      expect(error?.message ?? '').not.toContain('сверх акцепта');
      expect(error?.message ?? '').not.toContain('Некорректное fact_quantity');
    });
  });
});

describe('MarketplaceAplReceptionService — единица заказа (фасовка) в акте приёмки', () => {
  let mocks: ReturnType<typeof buildMocks>;
  let service: MarketplaceAplReceptionService;

  beforeEach(() => {
    mocks = buildMocks();
    service = buildService(mocks);
  });

  it('отпуск упаковкой (Эпик 18) → акт в упаковках: кол-во=5, цена за упаковку, единица «упак. 0,1 кг»', async () => {
    // Зеркало теста MarketplaceIssuanceService (выдача) — приёмка и выдача
    // ведут акт в единицах отпуска: при упаковочном отпуске количество — число
    // упаковок, цена — за упаковку, сумма = количество × цену.
    const reception = buildReception({
      fact_quantity_per_order: [{ order_id: 'order-1', fact_quantity: 0.5 } as any],
    });
    const order = buildOrder({
      id: 'order-1',
      offer_id: 'offer-1',
      quantity: 0.5,
      unit_of_measure: 'kg',
      package_size: 0.1,
      price_per_unit: '100.0000',
      total_cost: '500.0000',
    });
    mocks.receptionRepo.findById.mockResolvedValue(reception);
    mocks.orderRepo.findByCycleId.mockResolvedValue([order]);
    mocks.offerRepo.findById.mockResolvedValue({
      id: 'offer-1',
      product_name: 'Икра',
      unit_of_measure: 'kg',
    });
    mocks.documentDomainService.generateDocument.mockResolvedValue({} as any);

    await service.getSupplierSignablePayloads('voskhod', 'apl-1');

    const action = mocks.documentDomainService.generateDocument.mock.calls[0][0].data;
    expect(action.fact_quantity).toBe(5);
    expect(action.unit_cost).toBe('100.0000');
    expect(action.total_amount).toBe('500.0000');
    expect(action.unit_of_measurement).toBe('упак. 0,1 кг');
  });
});
