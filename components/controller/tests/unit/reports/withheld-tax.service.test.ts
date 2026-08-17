import { ServiceUnavailableException } from '@nestjs/common';
import { WithheldTaxService } from '~/extensions/reports/application/services/withheld-tax.service';
import { PaymentStatusEnum } from '~/domain/gateway/enums/payment-status.enum';

/**
 * Стол бухгалтера показывает удержанный налог через порт контура: удержания
 * ведёт то расширение, которое выплачивает доход физлицу. Проверяем ровно то,
 * что стол добавляет от себя, — расчётный период платежа и поведение без
 * источника удержаний.
 */

const COOPNAME = 'voskhod';

function payment(createdAt: string, overrides: Record<string, any> = {}) {
  return {
    hash: 'abc123',
    amount: '1300.0000 RUB',
    symbol: 'RUB',
    memo: 'ЕНП',
    status: PaymentStatusEnum.PENDING,
    created_at: new Date(createdAt),
    ...overrides,
  };
}

function makeService(items: any[] = []) {
  const port = {
    getState: jest.fn().mockResolvedValue({
      withheld: '1300.0000 RUB',
      in_payment: '0.0000 RUB',
      available: '1300.0000 RUB',
    }),
    listPayments: jest.fn().mockResolvedValue({
      items,
      totalCount: items.length,
      totalPages: 1,
      currentPage: 1,
    }),
    createPayment: jest.fn().mockResolvedValue('1300.0000 RUB'),
  };
  return { service: new WithheldTaxService(port as any), port };
}

describe('WithheldTaxService — перечисление удержанного налога на столе бухгалтера', () => {
  describe('расчётный период платежа', () => {
    it('платёж до 22-го числа включительно относится к первой половине месяца', async () => {
      const { service } = makeService([payment('2026-08-17T10:00:00Z')]);

      const page = await service.listPayments(COOPNAME, 1, 20);

      expect(page.items[0].report_year).toBe(2026);
      // Август — восьмой месяц, первый период месяца: (8-1)*2 + 1 = 15.
      expect(page.items[0].report_period).toBe(15);
      expect(page.items[0].report_period_label).toBe('Август · 1–22');
    });

    it('платёж с 23-го числа относится ко второй половине месяца', async () => {
      const { service } = makeService([payment('2026-08-23T10:00:00Z')]);

      const page = await service.listPayments(COOPNAME, 1, 20);

      expect(page.items[0].report_period).toBe(16);
      expect(page.items[0].report_period_label).toBe('Август · 23–конец');
    });

    it('поздний вечер 22-го по UTC — это уже 23-е по налоговому поясу, и период следующий', async () => {
      // 22 августа 21:30 UTC = 23 августа 00:30 MSK. Считать по UTC значило бы
      // отнести платёж к чужому расчётному периоду.
      const { service } = makeService([payment('2026-08-22T21:30:00Z')]);

      const page = await service.listPayments(COOPNAME, 1, 20);

      expect(page.items[0].report_period).toBe(16);
    });

    it('платёж 31 декабря поздним вечером по UTC попадает в следующий год', async () => {
      const { service } = makeService([payment('2026-12-31T22:00:00Z')]);

      const page = await service.listPayments(COOPNAME, 1, 20);

      expect(page.items[0].report_year).toBe(2027);
      expect(page.items[0].report_period).toBe(1);
      expect(page.items[0].report_period_label).toBe('Январь · 1–22');
    });

    it('поля платежа доходят до стола без искажений', async () => {
      const { service } = makeService([
        payment('2026-08-17T10:00:00Z', {
          status: PaymentStatusEnum.FAILED,
          message: 'счёт заблокирован',
          recipient_name: 'Казначейство России (ФНС России)',
        }),
      ]);

      const page = await service.listPayments(COOPNAME, 1, 20);

      expect(page.items[0].status).toBe(PaymentStatusEnum.FAILED);
      expect(page.items[0].message).toBe('счёт заблокирован');
      expect(page.items[0].recipient_name).toBe('Казначейство России (ФНС России)');
    });
  });

  describe('источник удержаний не подключён', () => {
    it('состояние нулевое, а не отказ: расширения, ведущего удержания, может не быть', async () => {
      const service = new WithheldTaxService();

      const state = await service.getState(COOPNAME);

      expect(state.withheld).toBe('0.0000 RUB');
      expect(state.available).toBe('0.0000 RUB');
    });

    it('история пуста', async () => {
      const service = new WithheldTaxService();

      const page = await service.listPayments(COOPNAME, 1, 20);

      expect(page.items).toEqual([]);
      expect(page.totalCount).toBe(0);
    });

    it('попытка заплатить отклоняется с причиной, а не молча', async () => {
      const service = new WithheldTaxService();

      await expect(service.pay(COOPNAME, 100)).rejects.toBeInstanceOf(
        ServiceUnavailableException
      );
    });
  });

  describe('передача запроса источнику', () => {
    it('история запрашивается от новых к старым', async () => {
      const { service, port } = makeService();

      await service.listPayments(COOPNAME, 2, 50);

      expect(port.listPayments).toHaveBeenCalledWith(COOPNAME, {
        page: 2,
        limit: 50,
        sortOrder: 'DESC',
      });
    });

    it('отправка на оплату уходит источнику удержаний как есть', async () => {
      const { service, port } = makeService();

      const paid = await service.pay(COOPNAME, 1300);

      expect(port.createPayment).toHaveBeenCalledWith(COOPNAME, 1300);
      expect(paid).toBe('1300.0000 RUB');
    });
  });
});
