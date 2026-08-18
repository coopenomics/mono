import { BadRequestException } from '@nestjs/common';
import { WithheldTaxService } from '~/extensions/reports/application/services/withheld-tax.service';
import { PaymentStatusEnum } from '~/domain/gateway/enums/payment-status.enum';
import { PaymentTypeEnum } from '~/domain/gateway/enums/payment-type.enum';

/**
 * Перечисление удержанного налога — раздел стола бухгалтера.
 *
 * Долг перед бюджетом копится в общекооперативном кошельке: туда стекаются
 * удержания любой программы, выплатившей доход физлицу. Бухгалтерия читает
 * остаток, отправляет сумму кассиру и связывает платёж с расчётным периодом,
 * за который подаётся уведомление.
 */

const COOPNAME = 'voskhod';

function makeService(overrides?: {
  walletBalance?: string | null;
  pending?: Array<{ amount: string }>;
  chainThrows?: boolean;
  country?: string | null;
  payments?: any[];
}) {
  // `??` здесь не годится: тест «кошелька ещё нет» передаёт null осознанно,
  // и подстановка дефолта его бы обесценила.
  const walletBalance =
    overrides && 'walletBalance' in overrides ? overrides.walletBalance : '5000.0000 RUB';

  const chainPort = {
    getWithheldTaxWalletBalance: jest.fn().mockResolvedValue(walletBalance),
    listPendingTaxRequests: jest.fn().mockResolvedValue(overrides?.pending ?? []),
    createTaxRequest: overrides?.chainThrows
      ? jest.fn().mockRejectedValue(new Error('цепь недоступна'))
      : jest.fn().mockResolvedValue({ transaction_id: 'tx-1' }),
  };

  const paymentDesk = {
    createSystemOutgoingPayment: jest.fn().mockResolvedValue({ id: 'pay-1' }),
    getPayments: jest.fn().mockResolvedValue({
      items: overrides?.payments ?? [{ id: 'pay-1' }],
      totalCount: (overrides?.payments ?? [{ id: 'pay-1' }]).length,
      totalPages: 1,
      currentPage: 1,
    }),
    setPaymentStatus: jest.fn().mockResolvedValue({}),
  };

  const orgRepo = {
    findByUsername: jest.fn().mockResolvedValue({ country: overrides?.country ?? 'Russia' }),
  };

  const service = new WithheldTaxService(
    chainPort as any,
    paymentDesk as any,
    orgRepo as any
  );
  return { service, chainPort, paymentDesk, orgRepo };
}

function payment(createdAt: string, overrides: Record<string, any> = {}) {
  return {
    hash: 'abc123',
    quantity: 1300,
    symbol: 'RUB',
    memo: 'ЕНП',
    status: PaymentStatusEnum.PENDING,
    created_at: new Date(createdAt),
    ...overrides,
  };
}

describe('WithheldTaxService — перечисление удержанного налога', () => {
  describe('состояние долга перед бюджетом', () => {
    it('остаток общекооперативного кошелька — это долг перед бюджетом', async () => {
      const { service } = makeService({ walletBalance: '1300.0000 RUB' });

      const state = await service.getState(COOPNAME);

      expect(state.withheld).toBe('1300.0000 RUB');
      expect(state.in_payment).toBe('0.0000 RUB');
      expect(state.available).toBe('1300.0000 RUB');
    });

    it('кошелька ещё нет (удержаний не было) — нули, а не падение', async () => {
      const { service } = makeService({ walletBalance: null });

      const state = await service.getState(COOPNAME);

      expect(state.withheld).toBe('0.0000 RUB');
      expect(state.available).toBe('0.0000 RUB');
    });

    it('отправленное кассиру вычитается из доступного: те же деньги нельзя отправить дважды', async () => {
      const { service } = makeService({
        walletBalance: '1300.0000 RUB',
        pending: [{ amount: '500.0000 RUB' }],
      });

      const state = await service.getState(COOPNAME);

      expect(state.in_payment).toBe('500.0000 RUB');
      expect(state.available).toBe('800.0000 RUB');
    });
  });

  describe('отправка на оплату', () => {
    it('заводит платёж кассиру и заявку на цепи с одним хэшем', async () => {
      const { service, chainPort, paymentDesk } = makeService({ walletBalance: '1300.0000 RUB' });

      const paid = await service.pay(COOPNAME, 1300);

      expect(paid).toBe('1300.0000 RUB');
      const paymentCall = paymentDesk.createSystemOutgoingPayment.mock.calls[0][0];
      const chainCall = chainPort.createTaxRequest.mock.calls[0][0];
      expect(paymentCall.payment_hash).toBe(chainCall.tax_hash);
      expect(paymentCall.type).toBe(PaymentTypeEnum.TAX);
      expect(paymentCall.status).toBe(PaymentStatusEnum.PENDING);
    });

    it('платёж заводит стол бухгалтера — по нему он и найдёт заявку в реестре кассира', async () => {
      const { service, paymentDesk } = makeService({ walletBalance: '1300.0000 RUB' });

      await service.pay(COOPNAME, 1300);

      expect(paymentDesk.createSystemOutgoingPayment.mock.calls[0][0].related_extension).toBe(
        'reports'
      );
    });

    it('больше удержанного отправить нельзя', async () => {
      const { service, chainPort } = makeService({ walletBalance: '1300.0000 RUB' });

      await expect(service.pay(COOPNAME, 2000)).rejects.toBeInstanceOf(BadRequestException);
      expect(chainPort.createTaxRequest).not.toHaveBeenCalled();
    });

    it('нельзя отправить то, что уже у кассира', async () => {
      const { service, chainPort } = makeService({
        walletBalance: '1300.0000 RUB',
        pending: [{ amount: '1300.0000 RUB' }],
      });

      await expect(service.pay(COOPNAME, 1300)).rejects.toBeInstanceOf(BadRequestException);
      expect(chainPort.createTaxRequest).not.toHaveBeenCalled();
    });

    it.each([0, -100])('сумма %s отклоняется', async (amount) => {
      const { service, chainPort } = makeService({ walletBalance: '1300.0000 RUB' });

      await expect(service.pay(COOPNAME, amount)).rejects.toBeInstanceOf(BadRequestException);
      expect(chainPort.createTaxRequest).not.toHaveBeenCalled();
    });

    it('кассир получает назначение платежа и реквизиты бюджета — заполнять их вручную не надо', async () => {
      const { service, paymentDesk } = makeService({ walletBalance: '1300.0000 RUB' });

      await service.pay(COOPNAME, 1300);

      const call = paymentDesk.createSystemOutgoingPayment.mock.calls[0][0];
      expect(call.memo).toBe('ЕНП');
      const rows = call.payment_details.data.requisite_rows as { label: string; value: string }[];
      expect(rows.find((r) => r.label === 'ИНН получателя')?.value).toBe('7727406020');
    });

    it('страна кооператива системе неизвестна — заявка всё равно создаётся, реквизиты кассир заполнит сам', async () => {
      const { service, paymentDesk } = makeService({
        walletBalance: '1300.0000 RUB',
        country: 'Georgia',
      });

      await service.pay(COOPNAME, 1300);

      const call = paymentDesk.createSystemOutgoingPayment.mock.calls[0][0];
      expect(call.payment_details).toBeUndefined();
      expect(call.memo).toBe('Перечисление удержанного НДФЛ');
    });

    it('цепь отказала — платёж кассира гасится, иначе он заплатит по несуществующей заявке', async () => {
      const { service, paymentDesk } = makeService({
        walletBalance: '1300.0000 RUB',
        chainThrows: true,
      });

      await expect(service.pay(COOPNAME, 1300)).rejects.toThrow();
      expect(paymentDesk.setPaymentStatus).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'pay-1', status: PaymentStatusEnum.CANCELLED })
      );
    });
  });

  describe('история перечислений и расчётный период', () => {
    it('история берётся из реестра кассира: подтверждённые заявки на цепи уже стёрты', async () => {
      const { service, paymentDesk } = makeService({
        payments: [payment('2026-08-17T10:00:00Z')],
      });

      const page = await service.listPayments(COOPNAME, 1, 20);

      expect(paymentDesk.getPayments).toHaveBeenCalledWith(
        { coopname: COOPNAME, type: PaymentTypeEnum.TAX },
        expect.objectContaining({ page: 1, limit: 20, sortOrder: 'DESC' })
      );
      expect(page.items[0].amount).toBe('1300.0000 RUB');
    });

    it('платёж до 22-го числа включительно относится к первой половине месяца', async () => {
      const { service } = makeService({ payments: [payment('2026-08-17T10:00:00Z')] });

      const page = await service.listPayments(COOPNAME, 1, 20);

      expect(page.items[0].report_year).toBe(2026);
      // Август — восьмой месяц, первый период месяца: (8-1)*2 + 1 = 15.
      expect(page.items[0].report_period).toBe(15);
      expect(page.items[0].report_period_label).toBe('Август · 1–22');
    });

    it('платёж с 23-го числа относится ко второй половине месяца', async () => {
      const { service } = makeService({ payments: [payment('2026-08-23T10:00:00Z')] });

      const page = await service.listPayments(COOPNAME, 1, 20);

      expect(page.items[0].report_period).toBe(16);
      expect(page.items[0].report_period_label).toBe('Август · 23–конец');
    });

    it('поздний вечер 22-го по UTC — это уже 23-е по налоговому поясу, и период следующий', async () => {
      // 22 августа 21:30 UTC = 23 августа 00:30 MSK. Считать по UTC значило бы
      // отнести платёж к чужому расчётному периоду.
      const { service } = makeService({ payments: [payment('2026-08-22T21:30:00Z')] });

      const page = await service.listPayments(COOPNAME, 1, 20);

      expect(page.items[0].report_period).toBe(16);
    });

    it('платёж 31 декабря поздним вечером по UTC попадает в следующий год', async () => {
      const { service } = makeService({ payments: [payment('2026-12-31T22:00:00Z')] });

      const page = await service.listPayments(COOPNAME, 1, 20);

      expect(page.items[0].report_year).toBe(2027);
      expect(page.items[0].report_period).toBe(1);
      expect(page.items[0].report_period_label).toBe('Январь · 1–22');
    });

    it('реквизиты отдаются снимком с платежа — те, по которым платили, а не сегодняшние', async () => {
      const { service } = makeService({
        payments: [
          payment('2026-08-17T10:00:00Z', {
            payment_details: {
              data: {
                recipient_name: 'Казначейство России (ФНС России)',
                requisite_rows: [{ label: 'ИНН получателя', value: '7727406020' }],
              },
            },
          }),
        ],
      });

      const page = await service.listPayments(COOPNAME, 1, 20);

      expect(page.items[0].recipient_name).toBe('Казначейство России (ФНС России)');
      expect(page.items[0].requisite_rows).toEqual([
        { label: 'ИНН получателя', value: '7727406020' },
      ]);
    });

    it('кассир не смог заплатить — причина отказа доходит до бухгалтера', async () => {
      const { service } = makeService({
        payments: [
          payment('2026-08-17T10:00:00Z', {
            status: PaymentStatusEnum.FAILED,
            message: 'счёт заблокирован',
          }),
        ],
      });

      const page = await service.listPayments(COOPNAME, 1, 20);

      expect(page.items[0].status).toBe(PaymentStatusEnum.FAILED);
      expect(page.items[0].message).toBe('счёт заблокирован');
    });

    it('платёж без реквизитов не ломает историю', async () => {
      const { service } = makeService({
        payments: [payment('2026-08-17T10:00:00Z', { payment_details: undefined })],
      });

      const page = await service.listPayments(COOPNAME, 1, 20);

      expect(page.items[0].recipient_name).toBeUndefined();
      expect(page.items[0].completed_at).toBeUndefined();
    });
  });
});
