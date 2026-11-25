/**
 * ЮKassa: комиссия из настроек и возврат денег по отклонённому платежу.
 *
 * Набор способов оплаты кооператив согласует с ЮKassa в магазине, форма
 * показывает включённые там способы. Возврат вызывает шлюз, когда кассир
 * отклоняет входящий платёж: деньги возвращаются только по оплаченному платежу
 * этого кооператива и не возвращаются дважды.
 */
const getPayment = jest.fn();
const createPayment = jest.fn();
const createRefund = jest.fn();
jest.mock('@a2seven/yoo-checkout', () => ({
  YooCheckout: jest.fn().mockImplementation(() => ({ getPayment, createPayment, createRefund })),
}));

import { configurePlatformSettings } from '@coopenomics/extension-kit';
import { YookassaExtension, amountToPayKopecks, refundIdempotenceKey } from '~/extensions/yookassa/yookassa-extension.module';

const HASH = 'a'.repeat(64);

function build(config: Record<string, unknown> = {}, payment: Record<string, unknown> = {}) {
  const stored = {
    id: 'db-1',
    hash: HASH,
    secret: 's3cret',
    symbol: 'RUB',
    quantity: 900,
    username: 'ant',
    created_at: new Date('2026-11-24T11:16:38Z'),
    payment_details: { data: { confirmation_token: 'tok', payment_id: 'yk-1', payment_methods: [] } },
    ...payment,
  };
  const payments = { findByHash: jest.fn().mockResolvedValue(stored) };
  const logger = { setContext: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };
  const ext = new YookassaExtension({} as any, payments as any, {} as any, logger as any, {} as any, {} as any);
  ext.extension = { config: { client: 'shop', secret: 'key', ...config } } as any;
  return { ext, payments, stored };
}

function paid(extra: Record<string, unknown> = {}) {
  return {
    id: 'yk-1',
    status: 'succeeded',
    amount: { value: '932.64', currency: 'RUB' },
    refunded_amount: { value: '0.00', currency: 'RUB' },
    metadata: { secret: 's3cret' },
    ...extra,
  };
}

describe('ЮKassa: платёж', () => {
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
  beforeEach(() => createPayment.mockReset());

  it('отдаёт столу токен и номер платежа ЮKassa: по номеру кассир потом возвращает деньги', async () => {
    const { ext } = build();
    createPayment.mockResolvedValue({ id: 'yk-9', confirmation: { confirmation_token: 'tok-9' } });

    const details = await ext.createPayment(HASH);

    expect(details.data).toEqual({ confirmation_token: 'tok-9', payment_id: 'yk-9' });
  });

  it('комиссия берётся из настроек: сумма к оплате покрывает её целиком', async () => {
    const { payments } = build();
    const logger = { setContext: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };
    const repository = { findByName: async () => ({ config: { client: 'shop', secret: 'key', fee_percent: 4.3 } }) };
    const registry = { registerProvider: jest.fn() };
    const ext = new YookassaExtension(repository as any, payments as any, {} as any, logger as any, {} as any, registry as any);
    await ext.initialize();
    createPayment.mockResolvedValue({ id: 'yk-9', confirmation: { confirmation_token: 'tok-9' } });

    const details = await ext.createPayment(HASH);

    // 900 / (1 − 0,043) = 940,44 → вверх до рубля: 941; комиссия 40,47 — поступит 900,53.
    expect(details.amount_plus_fee).toBe('941.00 RUB');
    expect(details.fee_amount).toBe('41.00 RUB');
  });
});

describe('ЮKassa: сумма к оплате', () => {
  // Худший для кооператива случай: ЮKassa округляет комиссию до копейки вверх.
  const received = (toPay: number, feePercent: number) => toPay - Math.ceil((toPay * Math.round(feePercent * 1000)) / 100_000);

  it('100 000 ₽ при 4,27 %: прежний расчёт давал 104 460,46 и недобор в копейку', () => {
    const toPay = amountToPayKopecks(10_000_000, 4.27);
    expect(toPay).toBe(10_446_100);
    expect(received(toPay, 4.27)).toBeGreaterThanOrEqual(10_000_000);
    // Прежняя сумма на копейку меньше: после комиссии, округлённой вверх, — 99 999,99.
    expect(received(10_446_046, 4.27)).toBe(9_999_999);
  });

  it('сумма — целые рубли, поступление не меньше взноса на любых суммах и ставках', () => {
    for (const fee of [0, 0.4, 0.7, 2.8, 3.5, 4.25, 4.27, 4.3, 6, 29.999]) {
      for (let amount = 1; amount <= 2_000_000; amount = Math.ceil(amount * 1.37) + 1) {
        const toPay = amountToPayKopecks(amount, fee);
        expect(toPay % 100).toBe(0);
        expect(received(toPay, fee)).toBeGreaterThanOrEqual(amount);
        // Лишнего рубля нет: на рубль меньше — уже недобор.
        expect(received(toPay - 100, fee)).toBeLessThan(amount);
      }
    }
  });

  it('неверная комиссия отклоняется кодом YOOKASSA_FEE_INVALID', () => {
    expect(() => amountToPayKopecks(100_000, 100)).toThrow(expect.objectContaining({ code: 'YOOKASSA_FEE_INVALID' }));
    expect(() => amountToPayKopecks(100_000, -1)).toThrow(expect.objectContaining({ code: 'YOOKASSA_FEE_INVALID' }));
  });
});

describe('ЮKassa: возврат по отклонённому платежу', () => {
  beforeEach(() => {
    getPayment.mockReset();
    createRefund.mockReset();
    (global as any).fetch = jest.fn();
  });

  it('оплаченный платёж возвращается целиком, ключ повтора — секрет платежа', async () => {
    const { ext } = build();
    getPayment.mockResolvedValue(paid());
    createRefund.mockResolvedValue({ id: 'rf-1', status: 'succeeded' });

    const result = await ext.refundPayment(HASH);

    expect(result).toEqual({ refunded: true, amount: '932.64 RUB' });
    expect(createRefund).toHaveBeenCalledWith(
      expect.objectContaining({ payment_id: 'yk-1', amount: { value: '932.64', currency: 'RUB' } }),
      refundIdempotenceKey('s3cret')
    );
  });

  it('ключ повтора не длиннее 64 знаков даже у секрета в 64 знака', () => {
    // 24.11.2026: ключ «refund-<секрет>» в 71 знак ЮKassa отклонила кодом 400.
    const key = refundIdempotenceKey('f'.repeat(64));
    expect(key.length).toBeLessThanOrEqual(64);
    expect(refundIdempotenceKey('f'.repeat(64))).toBe(key);
  });

  it('отказ ЮKassa доходит до кассира с текстом, а не «Internal Server Error»', async () => {
    const { ext } = build();
    getPayment.mockResolvedValue(paid());
    createRefund.mockRejectedValue({ type: 'error', code: 'invalid_request', description: 'Idempotence key is too long' });

    await expect(ext.refundPayment(HASH)).rejects.toMatchObject({
      code: 'YOOKASSA_REQUEST_REFUSED',
      params: { description: 'Idempotence key is too long' },
    });
  });

  it('уже возвращённое второй раз не возвращается', async () => {
    const { ext } = build();
    getPayment.mockResolvedValue(paid({ refunded_amount: { value: '932.64', currency: 'RUB' } }));

    const result = await ext.refundPayment(HASH);

    expect(result).toEqual({ refunded: true, amount: '932.64 RUB' });
    expect(createRefund).not.toHaveBeenCalled();
  });

  it('неоплаченный платёж — возвращать нечего', async () => {
    const { ext } = build();
    getPayment.mockResolvedValue(paid({ status: 'pending' }));

    expect(await ext.refundPayment(HASH)).toEqual({ refunded: false });
    expect(createRefund).not.toHaveBeenCalled();
  });

  it('чужой платёж ЮKassa (другой секрет) не возвращается', async () => {
    const { ext } = build();
    getPayment.mockResolvedValue(paid({ metadata: { secret: 'other' } }));

    await expect(ext.refundPayment(HASH)).rejects.toMatchObject({ code: 'YOOKASSA_REFUND_FOREIGN_PAYMENT' });
    expect(createRefund).not.toHaveBeenCalled();
  });

  it('отказ ЮKassa в возврате — ошибка, платёж не считается возвращённым', async () => {
    const { ext } = build();
    getPayment.mockResolvedValue(paid());
    createRefund.mockResolvedValue({ id: 'rf-1', status: 'canceled' });

    await expect(ext.refundPayment(HASH)).rejects.toMatchObject({ code: 'YOOKASSA_REFUND_CANCELED' });
  });

  it('старый платёж без номера ЮKassa находится по секрету кооператива', async () => {
    const { ext } = build({}, { payment_details: { data: 'old-token' } });
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ items: [{ id: 'yk-x', metadata: { secret: 'other' } }, { id: 'yk-1', metadata: { secret: 's3cret' } }] }),
    });
    getPayment.mockResolvedValue(paid());
    createRefund.mockResolvedValue({ id: 'rf-1', status: 'pending' });

    const result = await ext.refundPayment(HASH);

    expect(getPayment).toHaveBeenCalledWith('yk-1');
    expect(result.refunded).toBe(true);
  });
});
