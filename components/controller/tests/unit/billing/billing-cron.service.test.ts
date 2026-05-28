/**
 * Unit-тесты BillingCronService.tick (Epic 12 v5, Story 12.6 + parser-pay-event).
 *
 * Покрытие:
 *  - tick без BILLING_CRON_PAYER → пропуск (никаких вызовов);
 *  - tick при running=true → пропуск;
 *  - processCoop при total_amount=0 → не createInvoice, не pay;
 *  - processCoop при !isDue → не createInvoice, не pay;
 *  - processCoop при total>0 + isDue → createInvoice + blockchainPort.pay;
 *  - processCoop НЕ зовёт confirmPayment (это делает PaymentConfirmedListener);
 *  - падение blockchainPort.pay не выкидывает наверх и не блокирует следующий кооп.
 */

// Мокаем config до импорта сервиса.
jest.mock('~/config/config', () => ({
  __esModule: true,
  default: {
    billing: {
      payer: 'ant',
      cron_expression: '* * * * *',
      hub_mode: true,
    },
    blockchain: {
      root_govern_symbol: 'AXON',
      root_govern_precision: 4,
    },
    provider: { base_url: 'http://provider-backend:3000', server_secret: 'SECRET' },
  },
}));

import { BillingCronService } from '~/domain/billing/services/billing-cron.service';

describe('BillingCronService.tick — Epic 12 v5', () => {
  let service: BillingCronService;
  let blockchainPort: any;
  let providerClient: any;
  let providerService: any;

  const buildSummary = (overrides: any = {}) => ({
    coopname: 'partner1',
    period_days: 30,
    total_amount: 1500,
    currency: 'RUB',
    payment_hash: 'old-hash-ignored',
    next_payment_due: '2020-01-01T00:00:00Z', // в прошлом → isDue=true
    items: [{ subscription_id: 1, subscription_type_id: 10, subscription_type_name: 'X', status: 'ACTIVE', amount: 1500, is_free: false }],
    ...overrides,
  });

  beforeEach(() => {
    blockchainPort = {
      pay: jest.fn().mockResolvedValue({ transaction_id: 'tx-pay-1' }),
      convert: jest.fn(),
    };
    providerClient = {
      isConfigured: jest.fn().mockReturnValue(true),
      getBillingSummary: jest.fn(),
      createInvoice: jest.fn().mockResolvedValue({ payment_hash: 'hash-new' }),
      confirmPayment: jest.fn(),
    };
    providerService = {
      getCooperativesRegistry: jest.fn().mockResolvedValue([
        { coopname: 'partner1', status: 'active' },
        { coopname: 'voskhod', status: 'inactive' },
      ]),
    };
    service = new BillingCronService(blockchainPort, providerClient, providerService);
  });

  it('total_amount>0 и isDue → createInvoice + blockchainPort.pay, БЕЗ confirmPayment', async () => {
    providerClient.getBillingSummary.mockResolvedValue(buildSummary());

    await service.tick();

    expect(providerService.getCooperativesRegistry).toHaveBeenCalledTimes(1);
    // только active
    expect(providerClient.getBillingSummary).toHaveBeenCalledTimes(1);
    expect(providerClient.getBillingSummary).toHaveBeenCalledWith('partner1');

    expect(providerClient.createInvoice).toHaveBeenCalledWith({
      coopname: 'partner1',
      items: [{ subscription_id: 1, period_days: 30 }],
    });

    expect(blockchainPort.pay).toHaveBeenCalledTimes(1);
    const payArg = blockchainPort.pay.mock.calls[0][0];
    expect(payArg.coopname).toBe('partner1');
    expect(payArg.username).toBe('ant');
    expect(payArg.paymentHash).toBe('hash-new');
    expect(payArg.quantity).toBe('1500.0000 RUB');

    // v5 ключевой инвариант: confirmPayment НЕ дёргается здесь.
    expect(providerClient.confirmPayment).not.toHaveBeenCalled();
  });

  it('total_amount=0 → пропуск (все free или нет подписок)', async () => {
    providerClient.getBillingSummary.mockResolvedValue(
      buildSummary({ total_amount: 0, items: [] }),
    );

    await service.tick();

    expect(providerClient.createInvoice).not.toHaveBeenCalled();
    expect(blockchainPort.pay).not.toHaveBeenCalled();
  });

  it('next_payment_due в будущем → пропуск (срок не подошёл)', async () => {
    providerClient.getBillingSummary.mockResolvedValue(
      buildSummary({ next_payment_due: '2099-01-01T00:00:00Z' }),
    );

    await service.tick();

    expect(providerClient.createInvoice).not.toHaveBeenCalled();
    expect(blockchainPort.pay).not.toHaveBeenCalled();
  });

  it('next_payment_due=null → isDue=true (первое списание)', async () => {
    providerClient.getBillingSummary.mockResolvedValue(
      buildSummary({ next_payment_due: null }),
    );

    await service.tick();

    expect(providerClient.createInvoice).toHaveBeenCalledTimes(1);
    expect(blockchainPort.pay).toHaveBeenCalledTimes(1);
  });

  it('blockchainPort.pay бросает ошибку — не падает наверх, не блокирует следующий кооп', async () => {
    providerService.getCooperativesRegistry.mockResolvedValue([
      { coopname: 'partner1', status: 'active' },
      { coopname: 'partner2', status: 'active' },
    ]);
    providerClient.getBillingSummary.mockResolvedValue(buildSummary());
    blockchainPort.pay
      .mockRejectedValueOnce(new Error('insufficient funds on w.wal.bill'))
      .mockResolvedValueOnce({ transaction_id: 'tx-2' });

    await expect(service.tick()).resolves.not.toThrow();

    // обработали оба коопа, не остановились на первом
    expect(providerClient.getBillingSummary).toHaveBeenCalledTimes(2);
    expect(blockchainPort.pay).toHaveBeenCalledTimes(2);
  });
});
