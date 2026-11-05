/**
 * Заявление на материальную помощь для строки и панели стола ПВЗ (задача
 * 99D-20, замечание владельца 04.11.2026): по строке видно сумму и стадию,
 * панель показывает налог, сумму на счёт и вехи процесса — подачу, решение
 * совета, платёж у кассира.
 *
 * Проверяется сборка вида из трёх источников: строка заявления в цепи
 * (сумма, статус, протокол), зеркало заявлений узла (дата подачи) и платёж
 * ядра (статус, реквизиты, даты). Пропавший источник не прячет заявление.
 */
import { PaymentStatus } from '@coopenomics/innercoop';
import {
  MarketplaceAidStage,
  MarketplaceEconomyService,
} from '~/extensions/marketplace/application/services/marketplace-economy.service';
import { calcNdflTax } from '~/extensions/marketplace/application/shared/ndfl.util';

const COOP = 'voskhod';
const HASH = 'AB'.repeat(32);
const ZERO = '0'.repeat(64);

type Aid = Record<string, unknown>;

function aid(over: Aid = {}): Aid {
  return {
    id: 1,
    hash: HASH,
    username: 'ivanpetrov',
    braname: 'krg',
    amount: '345.0000 RUB',
    status: 'pending',
    statement: { hash: 'cd'.repeat(32), signatures: [] },
    protocol: { hash: ZERO, signatures: [] },
    ...over,
  };
}

function build(opts: { aids: Aid[]; payment?: Record<string, unknown> | null; mirror?: Record<string, unknown> | null; paymentsFail?: boolean }) {
  // Заявления одного получателя цепь отдаёт по индексу получателя — заглушка отбирает так же.
  const chainPort = {
    listAids: jest.fn(async (_coopname: string, username?: string) => (username ? opts.aids.filter((a) => a.username === username) : opts.aids)),
  } as any;
  const coreGateway = {
    getPayments: opts.paymentsFail
      ? jest.fn().mockRejectedValue(new Error('нет связи'))
      : jest.fn().mockResolvedValue({ items: opts.payment ? [opts.payment] : [] }),
  } as any;
  const paymentMethodRepo = {
    get: jest.fn().mockResolvedValue({ method_type: 'sbp', data: { phone: '+79990001231' } }),
  } as any;
  const aidStore = { findOne: jest.fn().mockResolvedValue(opts.mirror ?? null) } as any;
  const service = new MarketplaceEconomyService(
    chainPort,
    {} as any,
    { symbol: 'RUB', decimals: 4 } as any,
    {} as any,
    {} as any,
    coreGateway,
    paymentMethodRepo,
    {} as any,
    {} as any,
    aidStore
  );
  return { service, coreGateway, aidStore };
}

describe('mkt.aid.view — заявление на матпомощь: налог, сумма на счёт, вехи процесса', () => {
  it('на рассмотрении совета: налог и сумма на счёт с сервера, дата подачи из зеркала; платёж ждёт решения совета — вех решения и платежа нет', async () => {
    const submitted = new Date('2026-11-04T09:00:00Z');
    // Платёж заводится при подаче скрытым от кассира — «ожидает решения совета».
    const { service, aidStore } = build({
      aids: [aid()],
      mirror: { created_at: submitted },
      payment: { status: PaymentStatus.AWAITING_AUTHORIZATION, payment_method_id: 'm1', created_at: submitted },
    });

    const [view] = await service.listAids(COOP);

    const tax = calcNdflTax(345, 4);
    expect(view.ndfl_tax).toBe(`${tax.toFixed(4)} RUB`);
    expect(view.net_amount).toBe(`${(345 - tax).toFixed(4)} RUB`);
    expect(view.stage).toBe(MarketplaceAidStage.ON_COUNCIL);
    expect(view.submitted_at?.toISOString()).toBe(submitted.toISOString());
    expect(view.decided_at).toBeNull();
    expect(view.payment_status).toBe(PaymentStatus.AWAITING_AUTHORIZATION);
    // Платёж заводится при подаче скрытым от кассира — веха платежа до решения совета не показывается.
    expect(view.payment_completed_at).toBeNull();
    // Зеркало узла хранит хэш строчными буквами — поиск по нему, не по записи цепи.
    expect(aidStore.findOne).toHaveBeenCalledWith({ aid_hash: HASH.toLowerCase() });
  });

  it('одобрено советом: дата решения — подпись протокола, вехи платежа — из платежа ядра', async () => {
    const created = new Date('2026-11-05T10:00:00Z');
    const completed = new Date('2026-11-05T12:00:00Z');
    const { service } = build({
      aids: [
        aid({
          status: 'authorized',
          protocol: { hash: 'ef'.repeat(32), signatures: [{ signed_at: '2026-11-05T08:30:00' }] },
        }),
      ],
      payment: { status: PaymentStatus.COMPLETED, payment_method_id: 'm1', created_at: created, completed_at: completed },
    });

    const [view] = await service.listAids(COOP);

    expect(view.stage).toBe(MarketplaceAidStage.AWAITING_PAYOUT);
    expect(view.decided_at?.toISOString()).toBe('2026-11-05T08:30:00.000Z');
    expect(view.payment_status).toBe(PaymentStatus.COMPLETED);
    expect(view.payment_completed_at).toBe(completed);
    expect(view.payment_failed_at).toBeNull();
    expect(view.payment_destination).toEqual(expect.any(String));
  });

  it('платёж ядра недоступен и строки зеркала нет — заявление показывается без вех', async () => {
    const { service } = build({ aids: [aid()], paymentsFail: true, mirror: null });

    const [view] = await service.listAids(COOP);

    expect(view.hash).toBe(HASH);
    expect(view.payment_status).toBeNull();
    expect(view.payment_destination).toBeNull();
    expect(view.submitted_at).toBeNull();
  });

  it('фильтр получателя: чужие заявления не попадают в список', async () => {
    const { service } = build({ aids: [aid(), aid({ hash: 'CD'.repeat(32), username: 'other' })] });

    const views = await service.listAids(COOP, 'ivanpetrov');

    expect(views.map((v) => v.username)).toEqual(['ivanpetrov']);
  });
});
