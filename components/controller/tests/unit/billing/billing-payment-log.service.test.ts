/**
 * Журнал платежей хаба (PG) — единственная защита от двойного списания:
 * контракт billing on-chain таблиц не ведёт (решение @ant 2026-06-11, RAM).
 * begin() либо заводит SUBMITTING, либо отдаёт существующую запись; FAILED
 * можно перезапустить через CAS; гонка двух тиков (23505) → «уже есть».
 */
import { BillingPaymentLogService } from '~/infrastructure/billing/billing-payment-log.service';
import { BillingPaymentLogStatus } from '~/infrastructure/billing/billing-payment-log.record';
import { recordingKysely, type ScriptedResult } from '../helpers/kysely-recorder';

const HASH = 'c'.repeat(64);

const row = (status: BillingPaymentLogStatus) => ({
  id: '00000000-0000-0000-0000-000000000001',
  payment_hash: HASH,
  coopname: 'partner1',
  quantity: '1500.0000 RUB',
  subject: null,
  status,
  tx_id: null,
  last_error: null,
  created_at: new Date('2026-10-01T00:00:00Z'),
  updated_at: new Date('2026-10-01T00:00:00Z'),
});

const build = (results: ScriptedResult[] = []) => {
  const { db, queries } = recordingKysely(results);
  return { svc: new BillingPaymentLogService(db as any), db, queries };
};

/** Вставка, которую база отвергла: записывающий драйвер ошибок не бросает. */
const rejectInsert = (db: any, error: Error) =>
  jest.spyOn(db, 'insertInto').mockReturnValue({ values: () => ({ execute: () => Promise.reject(error) }) } as any);

describe('BillingPaymentLogService.begin', () => {
  it('happy: записи нет → insert SUBMITTING, started=true', async () => {
    const h = build([{ rows: [] }, {}]);
    await expect(h.svc.begin(HASH, 'partner1', '1500.0000 RUB')).resolves.toEqual({ started: true });
    expect(h.queries).toHaveLength(2);
    expect(h.queries[1].sql).toMatch(/^insert into "billing_payment_log"/);
    expect(h.queries[1].parameters).toEqual(
      expect.arrayContaining([HASH, 'partner1', '1500.0000 RUB', BillingPaymentLogStatus.SUBMITTING])
    );
  });

  it('break: запись SUBMITTED/SUBMITTING/CONFIRMED есть → started=false с existing, insert не вызывается', async () => {
    for (const status of [BillingPaymentLogStatus.SUBMITTED, BillingPaymentLogStatus.SUBMITTING, BillingPaymentLogStatus.CONFIRMED]) {
      const h = build([{ rows: [row(status)] }]);
      const r = await h.svc.begin(HASH, 'partner1', '1500.0000 RUB');
      expect(r.started).toBe(false);
      expect(r.existing?.status).toBe(status);
      expect(h.queries).toHaveLength(1);
    }
  });

  it('side: FAILED (доменный отказ ноды) → CAS FAILED→SUBMITTING, started=true; проигранный CAS (0 строк) → started=false', async () => {
    const ok = build([{ rows: [row(BillingPaymentLogStatus.FAILED)] }, { affected: 1 }]);
    await expect(ok.svc.begin(HASH, 'partner1', '1500.0000 RUB', 'Хостинг на сервере')).resolves.toEqual({ started: true });
    const cas = ok.queries[1];
    expect(cas.sql).toMatch(/^update "billing_payment_log" set .*"status" = \$1.*"last_error" = \$2.*"subject" = \$3.*"updated_at" = now\(\)/);
    expect(cas.sql).toMatch(/where "payment_hash" = \$\d+ and "status" = \$\d+$/);
    expect(cas.parameters).toEqual([BillingPaymentLogStatus.SUBMITTING, null, 'Хостинг на сервере', HASH, BillingPaymentLogStatus.FAILED]);

    const lost = build([{ rows: [row(BillingPaymentLogStatus.FAILED)] }, { affected: 0 }]);
    await expect(lost.svc.begin(HASH, 'partner1', '1500.0000 RUB')).resolves.toMatchObject({ started: false });
  });

  it('break: гонка двух тиков — insert отдал 23505 → started=false, existing перечитан; другая ошибка БД пробрасывается', async () => {
    const raced = build([{ rows: [] }, { rows: [row(BillingPaymentLogStatus.SUBMITTING)] }]);
    rejectInsert(raced.db, Object.assign(new Error('dup'), { code: '23505' }));
    await expect(raced.svc.begin(HASH, 'partner1', '1500.0000 RUB')).resolves.toMatchObject({
      started: false,
      existing: { status: BillingPaymentLogStatus.SUBMITTING },
    });

    const broken = build([{ rows: [] }]);
    rejectInsert(broken.db, new Error('connection refused'));
    await expect(broken.svc.begin(HASH, 'partner1', '1500.0000 RUB')).rejects.toThrow('connection refused');
  });

  it('side: markFailed/recordError режут причину до 4000 символов; markConfirmed без tx_id не затирает его', async () => {
    const h = build();
    await h.svc.markFailed(HASH, 'x'.repeat(5000));
    expect(h.queries[0].parameters).toEqual([BillingPaymentLogStatus.FAILED, 'x'.repeat(4000), HASH]);
    await h.svc.recordError(HASH, 'y'.repeat(5000));
    expect(h.queries[1].parameters).toEqual(['y'.repeat(4000), HASH]);
    await h.svc.markConfirmed(HASH);
    expect(h.queries[2].sql).not.toMatch(/"tx_id"/);
    expect(h.queries[2].parameters).toEqual([BillingPaymentLogStatus.CONFIRMED, HASH]);
  });
});
