/**
 * Уведомления ЮKassa не подписаны, поэтому обработчик верит не телу, а самой
 * ЮKassa: платёж перезапрашивается по id ключом магазина. Поддельное тело не
 * должно ни менять статус, ни занимать журнал уведомлений раньше настоящего.
 */
const getPayment = jest.fn();
jest.mock('@a2seven/yoo-checkout', () => ({
  YooCheckout: jest.fn().mockImplementation(() => ({ getPayment })),
}));

import { configurePlatformSettings } from '@coopenomics/extension-kit';
import { PaymentStatus } from '@coopenomics/innercoop';
import { YookassaExtension } from '~/extensions/yookassa/yookassa-extension.module';

const PAYMENT = { id: 'db-1', secret: 's3cret', symbol: 'RUB', quantity: 100 };

function build() {
  const payments = {
    list: jest.fn().mockResolvedValue({ items: [PAYMENT] }),
    update: jest.fn().mockResolvedValue(undefined),
  };
  const noticeLog = { find: jest.fn().mockResolvedValue(null), record: jest.fn().mockResolvedValue(undefined) };
  const logger = { setContext: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };
  const channel = { publish: jest.fn().mockResolvedValue(undefined) };
  const ext = new YookassaExtension({} as any, payments as any, noticeLog as any, logger as any, channel as any, {} as any);
  ext.extension = { config: { client: 'shop', secret: 'key' } } as any;
  return { ext, payments, noticeLog };
}

function notice(event: string, value: string) {
  return {
    type: 'notification',
    event,
    object: { id: 'yk-1', status: 'succeeded', amount: { value, currency: 'RUB' }, income_amount: { value, currency: 'RUB' }, metadata: { secret: 's3cret' } },
  } as any;
}

describe('ЮKassa IPN: статус берётся у ЮKassa, а не из тела', () => {
  beforeAll(() => {
    configurePlatformSettings({
      coopname: 'voskhod',
      frontendUrl: 'http://localhost',
      backendUrl: 'http://localhost',
      timezone: 'Europe/Moscow',
      environment: 'test',
      blockchain: {} as any,
    });
  });
  beforeEach(() => getPayment.mockReset());

  it('поддельное «оплачено» при неоплаченном платеже — статус не меняется и журнал не занят', async () => {
    const { ext, payments, noticeLog } = build();
    getPayment.mockResolvedValue({ id: 'yk-1', status: 'pending', amount: { value: '100.00', currency: 'RUB' }, metadata: { secret: 's3cret' } });

    await ext.handleIPN(notice('payment.succeeded', '100.00'));

    expect(getPayment).toHaveBeenCalledWith('yk-1');
    expect(payments.update).not.toHaveBeenCalled();
    expect(noticeLog.record).not.toHaveBeenCalled();
  });

  it('сумма берётся из ответа ЮKassa: завышенное тело не проводит недоплату', async () => {
    const { ext, payments } = build();
    getPayment.mockResolvedValue({
      id: 'yk-1',
      status: 'succeeded',
      amount: { value: '10.00', currency: 'RUB' },
      income_amount: { value: '10.00', currency: 'RUB' },
      metadata: { secret: 's3cret' },
    });

    await ext.handleIPN(notice('payment.succeeded', '100.00'));

    expect(payments.update).toHaveBeenCalledWith('db-1', expect.objectContaining({ status: PaymentStatus.FAILED }));
  });

  it('подтверждённая ЮKassa оплата проводится', async () => {
    const { ext, payments, noticeLog } = build();
    getPayment.mockResolvedValue({
      id: 'yk-1',
      status: 'succeeded',
      amount: { value: '103.50', currency: 'RUB' },
      income_amount: { value: '100.00', currency: 'RUB' },
      metadata: { secret: 's3cret' },
    });

    await ext.handleIPN(notice('payment.succeeded', '100.00'));

    expect(noticeLog.record).toHaveBeenCalled();
    expect(payments.update).toHaveBeenCalledWith('db-1', { status: PaymentStatus.PAID });
  });

  it('платёж без секрета кооператива не проводится чужому пополнению', async () => {
    // Пустой секрет выключал фильтр выборки, и оплату получал последний
    // входящий платёж любого пайщика. Такой платёж создавали не мы — пропускаем.
    const { ext, payments } = build();
    getPayment.mockResolvedValue({
      id: 'yk-1',
      status: 'succeeded',
      amount: { value: '100.00', currency: 'RUB' },
      income_amount: { value: '100.00', currency: 'RUB' },
      metadata: {},
    });

    await ext.handleIPN(notice('payment.succeeded', '100.00'));

    expect(payments.list).not.toHaveBeenCalled();
    expect(payments.update).not.toHaveBeenCalled();
  });

  it('ЮKassa не отвечает — ошибка, чтобы уведомление пришло повторно', async () => {
    const { ext, noticeLog } = build();
    getPayment.mockRejectedValue(new Error('timeout'));

    await expect(ext.handleIPN(notice('payment.succeeded', '100.00'))).rejects.toThrow('timeout');
    expect(noticeLog.record).not.toHaveBeenCalled();
  });
});
