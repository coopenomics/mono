import { BadRequestException } from '@nestjs/common';
import { MarketplaceTaxService } from './marketplace-tax.service';
import { PaymentStatusEnum } from '~/domain/gateway/enums/payment-status.enum';
import { PaymentTypeEnum } from '~/domain/gateway/enums/payment-type.enum';

const COOPNAME = 'voskhod';
const ASSET_CONFIG = { symbol: 'RUB', decimals: 4 };

function makeService(overrides?: {
  walletBalance?: string | null;
  taxRows?: Array<{ amount: string }>;
  chainThrows?: boolean;
  /** Страна регистрации кооператива — от неё зависят реквизиты бюджета. */
  country?: string | null;
}) {
  // `??` здесь не годится: тест «кошелька ещё нет» передаёт null осознанно,
  // и подстановка дефолта его бы обесценила.
  const walletBalance =
    overrides && 'walletBalance' in overrides ? overrides.walletBalance : '5000.0000 RUB';
  const chainPort = {
    getCooperativeWalletBalance: jest.fn().mockResolvedValue(walletBalance),
    listTaxPayments: jest.fn().mockResolvedValue(overrides?.taxRows ?? []),
    createTaxPayment: overrides?.chainThrows
      ? jest.fn().mockRejectedValue(new Error('цепь недоступна'))
      : jest.fn().mockResolvedValue({ transaction_id: 'tx-1' }),
  };
  const coreGateway = {
    createSystemOutgoingPayment: jest.fn().mockResolvedValue({ id: 'pay-1' }),
    getPayments: jest.fn().mockResolvedValue({ items: [{ id: 'pay-1' }] }),
    setPaymentStatus: jest.fn().mockResolvedValue({}),
  };

  const orgRepo = {
    findByUsername: jest.fn().mockResolvedValue({ country: overrides?.country ?? 'Russia' }),
  };

  const service = new MarketplaceTaxService(
    chainPort as any,
    ASSET_CONFIG as any,
    coreGateway as any,
    orgRepo as any
  );
  return { service, chainPort, coreGateway, orgRepo };
}

describe('MarketplaceTaxService — перечисление удержанного НДФЛ', () => {
  describe('getTaxState', () => {
    it('остаток кошелька — это долг перед бюджетом', async () => {
      const { service } = makeService({ walletBalance: '1300.0000 RUB' });

      const state = await service.getTaxState(COOPNAME);

      expect(state.withheld).toBe('1300.0000 RUB');
      expect(state.in_payment).toBe('0.0000 RUB');
      expect(state.available).toBe('1300.0000 RUB');
    });

    it('кошелька ещё нет (удержаний не было) — нули, а не падение', async () => {
      const { service } = makeService({ walletBalance: null });

      const state = await service.getTaxState(COOPNAME);

      expect(state.withheld).toBe('0.0000 RUB');
      expect(state.available).toBe('0.0000 RUB');
    });

    it('отправленное кассиру вычитается из доступного — иначе те же деньги ушли бы дважды', async () => {
      const { service } = makeService({
        walletBalance: '1300.0000 RUB',
        taxRows: [{ amount: '500.0000 RUB' }, { amount: '300.0000 RUB' }],
      });

      const state = await service.getTaxState(COOPNAME);

      expect(state.in_payment).toBe('800.0000 RUB');
      expect(state.available).toBe('500.0000 RUB');
    });

    it('заявок больше, чем остаток, — доступное не уходит в минус', async () => {
      const { service } = makeService({
        walletBalance: '100.0000 RUB',
        taxRows: [{ amount: '500.0000 RUB' }],
      });

      const state = await service.getTaxState(COOPNAME);

      expect(state.available).toBe('0.0000 RUB');
    });
  });

  describe('createTaxPayment', () => {
    it('создаёт платёж кассиру и заявку на цепи', async () => {
      const { service, chainPort, coreGateway } = makeService({ walletBalance: '1300.0000 RUB' });

      const asset = await service.createTaxPayment(COOPNAME, 1300);

      expect(asset).toBe('1300.0000 RUB');
      expect(coreGateway.createSystemOutgoingPayment).toHaveBeenCalledWith(
        expect.objectContaining({
          coopname: COOPNAME,
          // Получателя-пайщика нет: деньги уходят в бюджет.
          username: COOPNAME,
          quantity: 1300,
          type: PaymentTypeEnum.TAX,
          // Решение совета не нужно — кассир видит заявку сразу.
          status: PaymentStatusEnum.PENDING,
        })
      );
      expect(chainPort.createTaxPayment).toHaveBeenCalledWith(
        expect.objectContaining({ coopname: COOPNAME, amount: '1300.0000 RUB' })
      );
    });

    it('hash платежа совпадает с hash заявки на цепи — по нему ищут платёж при подтверждении', async () => {
      const { service, chainPort, coreGateway } = makeService({ walletBalance: '1300.0000 RUB' });

      await service.createTaxPayment(COOPNAME, 100);

      const paymentHash = coreGateway.createSystemOutgoingPayment.mock.calls[0][0].payment_hash;
      const chainHash = chainPort.createTaxPayment.mock.calls[0][0].tax_hash;
      expect(paymentHash).toBe(chainHash);
    });

    it('больше удержанного отправить нельзя', async () => {
      const { service, chainPort, coreGateway } = makeService({ walletBalance: '1000.0000 RUB' });

      await expect(service.createTaxPayment(COOPNAME, 1500)).rejects.toThrow(BadRequestException);
      expect(coreGateway.createSystemOutgoingPayment).not.toHaveBeenCalled();
      expect(chainPort.createTaxPayment).not.toHaveBeenCalled();
    });

    it('нельзя отправить то, что уже у кассира', async () => {
      const { service, chainPort } = makeService({
        walletBalance: '1000.0000 RUB',
        taxRows: [{ amount: '900.0000 RUB' }],
      });

      await expect(service.createTaxPayment(COOPNAME, 500)).rejects.toThrow(BadRequestException);
      expect(chainPort.createTaxPayment).not.toHaveBeenCalled();
    });

    it.each([0, -100])('сумма %p отклоняется', async (amount) => {
      const { service, coreGateway } = makeService();

      await expect(service.createTaxPayment(COOPNAME, amount)).rejects.toThrow(BadRequestException);
      expect(coreGateway.createSystemOutgoingPayment).not.toHaveBeenCalled();
    });

    it('кассир получает назначение платежа и реквизиты бюджета — заполнять их вручную не надо', async () => {
      const { service, coreGateway } = makeService({ walletBalance: '1300.0000 RUB' });

      await service.createTaxPayment(COOPNAME, 1300);

      const call = coreGateway.createSystemOutgoingPayment.mock.calls[0][0];
      // С 01.04.2026 назначением платежа на единый налоговый счёт служит
      // аббревиатура «ЕНП» — прежняя расшифровка больше не канон.
      expect(call.memo).toBe('ЕНП');
      expect(call.payment_details.data.recipient_name).toBe('Казначейство России (ФНС России)');
      const rows: Array<{ label: string; value: string }> = call.payment_details.data.requisite_rows;
      expect(rows.find((r) => r.label === 'КБК')?.value).toBe('18201061201010000510');
      // КПП получателя сменился 05.12.2025 — старое значение 770801001 платёж
      // уже не идентифицирует.
      expect(rows.find((r) => r.label === 'КПП получателя')?.value).toBe('770701001');
    });

    it('страна кооператива системе неизвестна — заявка всё равно создаётся, реквизиты кассир заполнит сам', async () => {
      const { service, coreGateway } = makeService({
        walletBalance: '1300.0000 RUB',
        country: 'Georgia',
      });

      await service.createTaxPayment(COOPNAME, 1300);

      const call = coreGateway.createSystemOutgoingPayment.mock.calls[0][0];
      expect(call.payment_details).toBeUndefined();
      expect(call.memo).toBe('Перечисление удержанного НДФЛ');
    });

    it('цепь отказала — платёж кассира гасится, иначе он заплатит по несуществующей заявке', async () => {
      const { service, coreGateway } = makeService({
        walletBalance: '1300.0000 RUB',
        chainThrows: true,
      });

      await expect(service.createTaxPayment(COOPNAME, 1300)).rejects.toThrow();
      expect(coreGateway.setPaymentStatus).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'pay-1', status: PaymentStatusEnum.CANCELLED })
      );
    });
  });

  describe('listTaxPayments', () => {
    function paymentRow(overrides: Record<string, any> = {}) {
      return {
        hash: 'abc123',
        quantity: 1300,
        symbol: 'RUB',
        memo: 'ЕНП',
        status: PaymentStatusEnum.COMPLETED,
        created_at: new Date('2026-08-17T10:00:00Z'),
        completed_at: new Date('2026-08-18T10:00:00Z'),
        payment_details: {
          data: {
            recipient_name: 'Казначейство России (ФНС России)',
            requisite_rows: [{ label: 'ИНН получателя', value: '7727406020' }],
          },
        },
        ...overrides,
      };
    }

    it('история берётся из реестра кассира, а не из цепи: подтверждённые заявки там уже стёрты', async () => {
      const { service, coreGateway } = makeService();
      coreGateway.getPayments.mockResolvedValue({
        items: [paymentRow()],
        totalCount: 1,
        totalPages: 1,
        currentPage: 1,
      });

      const page = await service.listTaxPayments(COOPNAME, {
        page: 1,
        limit: 20,
        sortOrder: 'DESC',
      });

      expect(coreGateway.getPayments).toHaveBeenCalledWith(
        { coopname: COOPNAME, type: PaymentTypeEnum.TAX },
        expect.objectContaining({ page: 1, limit: 20, sortOrder: 'DESC' })
      );
      expect(page.totalCount).toBe(1);
      expect(page.items[0].amount).toBe('1300.0000 RUB');
      expect(page.items[0].status).toBe(PaymentStatusEnum.COMPLETED);
    });

    it('реквизиты отдаются снимком с платежа — те, по которым платили, а не сегодняшние', async () => {
      const { service, coreGateway } = makeService();
      coreGateway.getPayments.mockResolvedValue({
        items: [paymentRow()],
        totalCount: 1,
        totalPages: 1,
        currentPage: 1,
      });

      const page = await service.listTaxPayments(COOPNAME, {
        page: 1,
        limit: 20,
        sortOrder: 'DESC',
      });

      expect(page.items[0].recipient_name).toBe('Казначейство России (ФНС России)');
      expect(page.items[0].requisite_rows).toEqual([
        { label: 'ИНН получателя', value: '7727406020' },
      ]);
    });

    it('платёж без реквизитов (страна неизвестна) не ломает историю', async () => {
      const { service, coreGateway } = makeService();
      coreGateway.getPayments.mockResolvedValue({
        items: [paymentRow({ payment_details: undefined, completed_at: undefined })],
        totalCount: 1,
        totalPages: 1,
        currentPage: 1,
      });

      const page = await service.listTaxPayments(COOPNAME, {
        page: 1,
        limit: 20,
        sortOrder: 'DESC',
      });

      expect(page.items[0].recipient_name).toBeUndefined();
      expect(page.items[0].requisite_rows).toBeUndefined();
      expect(page.items[0].completed_at).toBeUndefined();
    });
  });
});
