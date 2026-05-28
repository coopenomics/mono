/**
 * Unit-тесты BillingService (Epic 12 v5).
 *
 * Покрытие:
 *  - deriveConvertHash — детерминированный sha256(documentHash + '/billing.convert');
 *  - convert — прокидывает convertHash в blockchain port;
 *  - getBillingSummary — маппинг полей provider → DTO controller'а.
 */

// Мокаем config до импорта сервиса.
jest.mock('~/config/config', () => ({
  __esModule: true,
  default: {
    billing: { payer: 'ant', cron_expression: '* * * * *', hub_mode: true },
    blockchain: { root_govern_symbol: 'AXON', root_govern_precision: 4 },
    provider: { base_url: 'http://provider-backend:3000', server_secret: 'SECRET' },
  },
}));

import { createHash } from 'node:crypto';
import { BillingService } from '~/application/billing/services/billing.service';

describe('BillingService — Epic 12 v5', () => {
  let service: BillingService;
  let blockchainPort: any;
  let providerClient: any;
  let documentDomainService: any;

  beforeEach(() => {
    blockchainPort = {
      convert: jest.fn().mockResolvedValue({ transaction_id: 'tx-convert-1' }),
      pay: jest.fn().mockResolvedValue({ transaction_id: 'tx-pay-1' }),
    };
    providerClient = {
      getBillingSummary: jest.fn(),
    };
    documentDomainService = {
      generateDocument: jest.fn(),
    };
    service = new BillingService(blockchainPort, providerClient, documentDomainService);
  });

  describe('convert (private deriveConvertHash через побочный эффект)', () => {
    it('передаёт в blockchainPort.convert convertHash = sha256(document.hash + "/billing.convert")', async () => {
      const documentHash = 'a'.repeat(64);
      const expectedConvertHash = createHash('sha256')
        .update(`${documentHash}/billing.convert`)
        .digest('hex');

      await service.convert({
        coopname: 'voskhod',
        username: 'ant',
        amount: '100.0000 AXON',
        document: {
          toDocument: () => ({ hash: documentHash, registry_id: 1095, signatures: [] }),
        } as any,
      });

      expect(blockchainPort.convert).toHaveBeenCalledTimes(1);
      const call = blockchainPort.convert.mock.calls[0][0];
      expect(call.convertHash).toBe(expectedConvertHash);
      expect(call.coopname).toBe('voskhod');
      expect(call.username).toBe('ant');
      expect(call.quantity).toBe('100.0000 AXON');
    });

    it('одинаковый document.hash даёт одинаковый convertHash (детерминированность)', async () => {
      const documentHash = 'b'.repeat(64);
      const doc = { toDocument: () => ({ hash: documentHash, registry_id: 1095, signatures: [] }) } as any;

      await service.convert({ coopname: 'voskhod', username: 'ant', amount: '1.0000 AXON', document: doc });
      await service.convert({ coopname: 'voskhod', username: 'ant', amount: '1.0000 AXON', document: doc });

      const h1 = blockchainPort.convert.mock.calls[0][0].convertHash;
      const h2 = blockchainPort.convert.mock.calls[1][0].convertHash;
      expect(h1).toBe(h2);
    });

    it('разный document.hash даёт разный convertHash', async () => {
      const doc1 = { toDocument: () => ({ hash: 'aaaa', registry_id: 1095, signatures: [] }) } as any;
      const doc2 = { toDocument: () => ({ hash: 'bbbb', registry_id: 1095, signatures: [] }) } as any;

      await service.convert({ coopname: 'voskhod', username: 'ant', amount: '1.0000 AXON', document: doc1 });
      await service.convert({ coopname: 'voskhod', username: 'ant', amount: '1.0000 AXON', document: doc2 });

      const h1 = blockchainPort.convert.mock.calls[0][0].convertHash;
      const h2 = blockchainPort.convert.mock.calls[1][0].convertHash;
      expect(h1).not.toBe(h2);
    });
  });

  describe('getBillingSummary', () => {
    it('маппит snake_case → camelCase, items.map в DTO', async () => {
      providerClient.getBillingSummary.mockResolvedValue({
        coopname: 'partner1',
        period_days: 30,
        total_amount: 2220,
        currency: 'RUB',
        payment_hash: 'hash-1',
        next_payment_due: '2026-06-30T00:00:00Z',
        items: [
          {
            subscription_id: 1,
            subscription_type_id: 10,
            subscription_type_name: 'Базовый документооборот',
            status: 'ACTIVE',
            amount: 1500,
            is_free: false,
          },
          {
            subscription_id: 2,
            subscription_type_id: 11,
            subscription_type_name: 'Хостинг',
            status: 'TRIAL',
            amount: 720,
            is_free: false,
          },
        ],
      });

      const result = await service.getBillingSummary('partner1', 30);

      expect(providerClient.getBillingSummary).toHaveBeenCalledWith('partner1', 30);
      expect(result.coopname).toBe('partner1');
      expect(result.periodDays).toBe(30);
      expect(result.totalAmount).toBe(2220);
      expect(result.currency).toBe('RUB');
      expect(result.paymentHash).toBe('hash-1');
      expect(result.nextPaymentDue).toBe('2026-06-30T00:00:00Z');
      expect(result.items).toHaveLength(2);
      expect(result.items[0]).toEqual({
        subscriptionId: 1,
        subscriptionTypeId: 10,
        subscriptionTypeName: 'Базовый документооборот',
        status: 'ACTIVE',
        amount: 1500,
        isFree: false,
      });
    });

    it('пустой items на стороне provider — пустой массив в DTO', async () => {
      providerClient.getBillingSummary.mockResolvedValue({
        coopname: 'partner1',
        period_days: 30,
        total_amount: 0,
        currency: 'RUB',
        payment_hash: 'hash-empty',
        next_payment_due: null,
        items: [],
      });

      const result = await service.getBillingSummary('partner1', 30);
      expect(result.items).toEqual([]);
      expect(result.totalAmount).toBe(0);
      expect(result.nextPaymentDue).toBeNull();
    });
  });
});
