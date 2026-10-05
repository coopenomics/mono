/**
 * Подписка, не закрывшаяся при выходе пайщика из кооператива: возврат по ней
 * ещё не лёг на кошелёк программы и в сумму выхода не войдёт. Такая подписка
 * помечается, закрытие повторяется само, администратор может повторить вручную.
 */
import { EdubridgeEnrollmentService } from '~/extensions/edubridge/application/services/edubridge-enrollment.service';
import { EduEnrollmentStatus } from '~/extensions/edubridge/domain/enums';

const logger = { setContext: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() } as any;
const course = { id: 'C1', title: 'Алгебра', lessons_per_month: 8, lessons_total: 64, starts_at: null } as any;

function enrollment(over: Record<string, unknown> = {}) {
  return {
    id: 'E1',
    coopname: 'voskhod',
    member_username: 'ant',
    learner_id: 'L1',
    course_id: 'C1',
    sub_hash: 'S1',
    status: EduEnrollmentStatus.ACTIVE,
    paid_amount: '1000.0000 RUB',
    paid_months: 1,
    paid_until: new Date('2026-12-01'),
    close_pending_since: null,
    close_error: null,
    ...over,
  } as any;
}

function make(rows: any[], chainFails: string | null) {
  const enrollments = {
    findByMember: jest.fn(async () => rows),
    findById: jest.fn(async (_c: string, id: string) => rows.find((r) => r.id === id) ?? null),
    findClosePending: jest.fn(async () => rows.filter((r) => r.close_pending_since)),
    save: jest.fn(async (e: any) => e),
  } as any;
  const courses = { findById: jest.fn(async () => ({ ...course })) } as any;
  const funds = { afterClosed: jest.fn(async () => undefined) } as any;
  const chain = {
    cancelSubscription: jest.fn(async () => {
      if (chainFails) throw new Error(chainFails);
      return { transaction_id: 'TRX' };
    }),
  } as any;
  const events = { emit: jest.fn() } as any;
  const service = new EdubridgeEnrollmentService(enrollments, courses, {} as any, funds, { findByEnrollment: jest.fn(async () => null) } as any, chain, {} as any, {} as any, logger, events);
  return { service, enrollments, chain };
}

describe('закрытие подписок при выходе пайщика', () => {
  it('сбой цепи помечает подписку и запоминает причину, выход при этом не падает', async () => {
    const row = enrollment();
    const { service } = make([row], 'узел не ответил');
    await expect(service.cancelAllForMember('voskhod', 'ant', 'exitcoop T1')).resolves.toEqual([]);
    expect(row.close_pending_since).toBeInstanceOf(Date);
    expect(row.close_error).toBe('узел не ответил');
    expect(row.status).toBe(EduEnrollmentStatus.ACTIVE);
  });

  it('повтор закрывает помеченную подписку и снимает отметку', async () => {
    const row = enrollment({ close_pending_since: new Date('2026-10-01'), close_error: 'узел не ответил' });
    const { service, chain } = make([row], null);
    await expect(service.retryPendingClosures('voskhod')).resolves.toBe(1);
    expect(chain.cancelSubscription).toHaveBeenCalledTimes(1);
    expect(row.status).toBe(EduEnrollmentStatus.CANCELLED);
    expect(row.close_pending_since).toBeNull();
    expect(row.close_error).toBeNull();
  });

  it('повтор при том же сбое оставляет отметку с прежней датой и свежей причиной', async () => {
    const since = new Date('2026-10-01');
    const row = enrollment({ close_pending_since: since, close_error: 'старая причина' });
    const { service } = make([row], 'площадка недоступна');
    await expect(service.retryPendingClosures('voskhod')).resolves.toBe(0);
    expect(row.close_pending_since).toBe(since);
    expect(row.close_error).toBe('площадка недоступна');
  });

  it('подписка, закрывшаяся другим путём, теряет отметку без обращения к цепи', async () => {
    const row = enrollment({ status: EduEnrollmentStatus.CANCELLED, close_pending_since: new Date('2026-10-01'), close_error: 'x' });
    const { service, chain } = make([row], null);
    await expect(service.retryPendingClosures('voskhod')).resolves.toBe(0);
    expect(chain.cancelSubscription).not.toHaveBeenCalled();
    expect(row.close_pending_since).toBeNull();
  });

  it('ручной повтор без отметки отклоняется, со сбоем — отдаёт отказ цепи администратору', async () => {
    const clean = enrollment();
    await expect(make([clean], null).service.retryClose('voskhod', 'E1')).rejects.toMatchObject({ code: 'EDUBRIDGE_SUBSCRIPTION_CLOSE_NOT_PENDING' });
    const marked = enrollment({ close_pending_since: new Date('2026-10-01') });
    await expect(make([marked], 'узел не ответил').service.retryClose('voskhod', 'E1')).rejects.toThrow('узел не ответил');
    expect(marked.close_pending_since).toBeInstanceOf(Date);
  });
});
