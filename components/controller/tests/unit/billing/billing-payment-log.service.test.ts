/**
 * Журнал платежей хаба (PG) — единственная защита от двойного списания:
 * контракт billing on-chain таблиц не ведёт (решение @ant 2026-06-11, RAM).
 * begin() либо заводит SUBMITTING, либо отдаёт существующую запись; FAILED
 * можно перезапустить через CAS; гонка двух тиков (23505) → «уже есть».
 */
import { BillingPaymentLogService } from '~/infrastructure/billing/billing-payment-log.service';
import { BillingPaymentLogStatus } from '~/infrastructure/billing/entities/billing-payment-log.entity';

const HASH = 'c'.repeat(64);

const build = (existing: any = null, updateAffected = 1) => {
  const repository = {
    findOne: jest.fn<Promise<any>, [any]>(async () => existing),
    insert: jest.fn<Promise<void>, [any]>(async () => undefined),
    update: jest.fn<Promise<{ affected: number }>, [any, any]>(async () => ({ affected: updateAffected })),
  };
  return { svc: new BillingPaymentLogService(repository as any), repository };
};

describe('BillingPaymentLogService.begin', () => {
  it('happy: записи нет → insert SUBMITTING, started=true', async () => {
    const h = build();
    await expect(h.svc.begin(HASH, 'partner1', '1500.0000 RUB')).resolves.toEqual({ started: true });
    expect(h.repository.insert).toHaveBeenCalledTimes(1);
    expect(h.repository.insert.mock.calls[0][0]).toMatchObject({ payment_hash: HASH, coopname: 'partner1', status: BillingPaymentLogStatus.SUBMITTING });
  });

  it('break: запись SUBMITTED/SUBMITTING/CONFIRMED есть → started=false с existing, insert не вызывается', async () => {
    for (const status of [BillingPaymentLogStatus.SUBMITTED, BillingPaymentLogStatus.SUBMITTING, BillingPaymentLogStatus.CONFIRMED]) {
      const h = build({ payment_hash: HASH, status });
      const r = await h.svc.begin(HASH, 'partner1', '1500.0000 RUB');
      expect(r.started).toBe(false);
      expect(r.existing?.status).toBe(status);
      expect(h.repository.insert).not.toHaveBeenCalled();
    }
  });

  it('side: FAILED (доменный отказ ноды) → CAS FAILED→SUBMITTING, started=true; проигранный CAS (affected=0) → started=false', async () => {
    const ok = build({ payment_hash: HASH, status: BillingPaymentLogStatus.FAILED }, 1);
    await expect(ok.svc.begin(HASH, 'partner1', '1500.0000 RUB')).resolves.toEqual({ started: true });
    expect(ok.repository.update).toHaveBeenCalledWith({ payment_hash: HASH, status: BillingPaymentLogStatus.FAILED }, { status: BillingPaymentLogStatus.SUBMITTING, last_error: null });

    const lost = build({ payment_hash: HASH, status: BillingPaymentLogStatus.FAILED }, 0);
    await expect(lost.svc.begin(HASH, 'partner1', '1500.0000 RUB')).resolves.toMatchObject({ started: false });
  });

  it('break: гонка двух тиков — insert отдал 23505 → started=false, existing перечитан; другая ошибка БД пробрасывается', async () => {
    const raced = build();
    raced.repository.insert.mockRejectedValueOnce(Object.assign(new Error('dup'), { code: '23505' }));
    raced.repository.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce({ payment_hash: HASH, status: BillingPaymentLogStatus.SUBMITTING });
    await expect(raced.svc.begin(HASH, 'partner1', '1500.0000 RUB')).resolves.toMatchObject({ started: false, existing: { status: BillingPaymentLogStatus.SUBMITTING } });

    const broken = build();
    broken.repository.insert.mockRejectedValueOnce(new Error('connection refused'));
    await expect(broken.svc.begin(HASH, 'partner1', '1500.0000 RUB')).rejects.toThrow('connection refused');
  });

  it('side: markFailed/recordError режут причину до 4000 символов; markConfirmed без tx_id не затирает его', async () => {
    const h = build();
    await h.svc.markFailed(HASH, 'x'.repeat(5000));
    expect(h.repository.update.mock.calls[0][1].last_error).toHaveLength(4000);
    await h.svc.markConfirmed(HASH);
    expect(h.repository.update.mock.calls[1][1]).toEqual({ status: BillingPaymentLogStatus.CONFIRMED });
  });
});
