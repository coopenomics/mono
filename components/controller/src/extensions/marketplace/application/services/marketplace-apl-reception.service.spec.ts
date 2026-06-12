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

  const logger = {
    setContext: jest.fn(),
    debug: jest.fn(),
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  } as any;

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
    documentDomainService,
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
    { symbol: 'RUB', decimals: 4 },
    mocks.coreGateway,
    mocks.supplierSettings,
    mocks.documentDomainService,
    new EventEmitter2(),
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
});
