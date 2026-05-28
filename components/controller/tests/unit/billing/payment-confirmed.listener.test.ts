/**
 * Unit-тесты PaymentConfirmedListener (Epic 12 v5).
 *
 * Listener живёт ТОЛЬКО на BILLING_HUB_MODE-узле (Воскход) и реагирует на
 * `action::billing::pay`. Должен:
 *  - извлечь payment_hash из action.data;
 *  - вызвать providerClient.confirmPayment({paymentHash, txId=action.transaction_id});
 *  - быть тихим при отсутствии payment_hash;
 *  - быть тихим при !isConfigured() (без provider'а слушать бессмысленно);
 *  - не выкидывать ошибку наверх (логирует и проглатывает — иначе один битый
 *    event замрозил бы шину EventEmitter2).
 */

// Мокаем config до импорта сервиса (иначе config.ts при отсутствии .env
// делает process.exit(1) — это валит jest worker).
jest.mock('~/config/config', () => ({
  __esModule: true,
  default: {
    billing: { payer: 'ant', cron_expression: '* * * * *', hub_mode: true },
    blockchain: { root_govern_symbol: 'AXON', root_govern_precision: 4 },
    provider: { base_url: 'http://provider-backend:3000', server_secret: 'SECRET' },
  },
}));

import { PaymentConfirmedListener } from '~/application/billing/listeners/payment-confirmed.listener';
import type { ActionDomainInterface } from '~/domain/parser/interfaces/action-domain.interface';

describe('PaymentConfirmedListener — Epic 12 v5', () => {
  let listener: PaymentConfirmedListener;
  let providerClient: any;

  const buildAction = (data: any = {}, overrides: Partial<ActionDomainInterface> = {}): ActionDomainInterface =>
    ({
      transaction_id: 'tx-pay-42',
      data,
      ...overrides,
    } as ActionDomainInterface);

  beforeEach(() => {
    providerClient = {
      isConfigured: jest.fn().mockReturnValue(true),
      confirmPayment: jest.fn().mockResolvedValue(undefined),
    };
    listener = new PaymentConfirmedListener(providerClient);
  });

  it('успех: дёргает confirmPayment с payment_hash и transaction_id', async () => {
    await listener.onBillingPay(buildAction({ payment_hash: 'hash-abc' }));
    expect(providerClient.confirmPayment).toHaveBeenCalledWith({
      paymentHash: 'hash-abc',
      txId: 'tx-pay-42',
    });
  });

  it('isConfigured()=false → пропуск (без вызова confirmPayment)', async () => {
    providerClient.isConfigured.mockReturnValue(false);
    await listener.onBillingPay(buildAction({ payment_hash: 'hash-abc' }));
    expect(providerClient.confirmPayment).not.toHaveBeenCalled();
  });

  it('action.data без payment_hash → пропуск без ошибки', async () => {
    await listener.onBillingPay(buildAction({}));
    expect(providerClient.confirmPayment).not.toHaveBeenCalled();
  });

  it('action.data=null → пропуск без ошибки', async () => {
    await listener.onBillingPay(buildAction(undefined));
    expect(providerClient.confirmPayment).not.toHaveBeenCalled();
  });

  it('пустой payment_hash → пропуск без вызова', async () => {
    await listener.onBillingPay(buildAction({ payment_hash: '' }));
    expect(providerClient.confirmPayment).not.toHaveBeenCalled();
  });

  it('confirmPayment бросает ошибку → listener её проглатывает (не падает наверх)', async () => {
    providerClient.confirmPayment.mockRejectedValue(new Error('provider 503'));
    await expect(
      listener.onBillingPay(buildAction({ payment_hash: 'hash-abc' })),
    ).resolves.not.toThrow();
  });
});
