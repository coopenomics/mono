/**
 * Реактивный мост billing::converttoaxn → провайдер (Epic 13 v5.1). Парсер
 * Восхода поймал action в блоке — хаб доносит подтверждение провайдеру и
 * закрывает свой журнал, даже если hub-cron упал между transact и confirm.
 * Не шлёт ничего вне hub-режима и при неполных данных action'а.
 */
let hubMode = true;
jest.mock('~/config/config', () => ({
  __esModule: true,
  default: { get billing() { return { hub_mode: hubMode }; } },
}));

import { BillingConversionListener } from '~/infrastructure/billing/billing-conversion.listener';

const HASH = 'b'.repeat(64);
const action = (data: any, txId = 'tx-1') => ({ data, transaction_id: txId } as any);

const build = (configured = true) => {
  const providerClient = { isConfigured: jest.fn(() => configured), confirmTopupAxon: jest.fn(async () => undefined) };
  const paymentLog = { markConfirmed: jest.fn(async () => undefined) };
  return { listener: new BillingConversionListener(providerClient as any, paymentLog as any), providerClient, paymentLog };
};

describe('BillingConversionListener.onConvertToAxn', () => {
  beforeEach(() => { hubMode = true; });

  it('happy: converttoaxn в блоке → confirmTopupAxon(coopname, payment_hash, сумма числом, tx) и журнал CONFIRMED', async () => {
    const h = build();
    await h.listener.onConvertToAxn(action({ coopname: 'partner1', amount: '1500.0000 RUB', payment_hash: HASH }));
    expect(h.providerClient.confirmTopupAxon).toHaveBeenCalledWith({ paymentHash: HASH, blockchainTransactionId: 'tx-1', coopname: 'partner1', amountRub: 1500 });
    expect(h.paymentLog.markConfirmed).toHaveBeenCalledWith(HASH, 'tx-1');
  });

  it('break: узел не в hub-режиме / provider не сконфигурирован → ничего не уходит', async () => {
    hubMode = false;
    const h = build();
    await h.listener.onConvertToAxn(action({ coopname: 'partner1', amount: '1500.0000 RUB', payment_hash: HASH }));
    expect(h.providerClient.confirmTopupAxon).not.toHaveBeenCalled();

    hubMode = true;
    const h2 = build(false);
    await h2.listener.onConvertToAxn(action({ coopname: 'partner1', amount: '1500.0000 RUB', payment_hash: HASH }));
    expect(h2.providerClient.confirmTopupAxon).not.toHaveBeenCalled();
  });

  it('break: нет coopname / payment_hash / нечисловая сумма → пропуск без вызова провайдера', async () => {
    for (const data of [{ amount: '1500.0000 RUB', payment_hash: HASH }, { coopname: 'partner1', amount: '1500.0000 RUB' }, { coopname: 'partner1', amount: 'abc', payment_hash: HASH }]) {
      const h = build();
      await h.listener.onConvertToAxn(action(data));
      expect(h.providerClient.confirmTopupAxon).not.toHaveBeenCalled();
    }
  });

  it('side: провайдер недоступен → ошибка логируется, не пробрасывается (парсер не останавливается)', async () => {
    const h = build();
    h.providerClient.confirmTopupAxon.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    await expect(h.listener.onConvertToAxn(action({ coopname: 'partner1', amount: '1500.0000 RUB', payment_hash: HASH }))).resolves.toBeUndefined();
  });
});
