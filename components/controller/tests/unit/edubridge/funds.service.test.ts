/** Средства программы: суммы считает контракт, служба вызывает его по одной подписке и сверяет записи с цепью. */
import { EdubridgeFundsService } from '~/extensions/edubridge/application/services/edubridge-funds.service';
import { EduEnrollmentStatus } from '~/extensions/edubridge/domain/enums';

const logger = { setContext: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() } as any;
const DAY = 86400_000;
const START = new Date('2026-09-01T00:00:00Z');
const at = (days: number) => new Date(START.getTime() + days * DAY);

/** Курс с гарантией 14 дней. */
const courseOf = (activated: boolean) => ({
  id: 'C1',
  chain_ref: '7',
  guarantee_days: 14,
  starts_at: activated ? START : null,
  teacher_reserve_balance: null,
  teacher_settled_total: null,
});

const enrollmentOf = (extra: Record<string, unknown> = {}) =>
  ({
    id: 'E1',
    sub_hash: 'aabb',
    course_id: 'C1',
    status: EduEnrollmentStatus.ACTIVE,
    locked_amount: '1000.0000 RUB',
    joined_at: START,
    created_at: START,
    ...extra,
  }) as any;

/** Строка подписки в цепи; `released` — гарантийный срок закрыт. */
const chainSub = (locked: string, released: boolean) => ({ locked, plan: { version: 1, released } });

function make(course: any, rows: any[], subs: any[]) {
  const enrollments = { findLocked: jest.fn(async () => rows.filter((r) => r.locked_amount)), save: jest.fn(async (e: any) => e) } as any;
  const courses = { findById: jest.fn(async () => course), save: jest.fn(async (c: any) => c) } as any;
  const readSubscription = jest.fn();
  subs.forEach((s) => readSubscription.mockResolvedValueOnce(s));
  const chain = {
    unlockFee: jest.fn(async () => ({})),
    readSubscription,
    readCourseFunds: jest.fn(async () => ({ reserve: '700.0000 RUB', settled: '0.0000 RUB' })),
  } as any;
  return { service: new EdubridgeFundsService(enrollments, courses, chain, logger, { viewOf: (c: any) => c, courseOf: jest.fn(async (...a: any[]) => (courses as any).findById(a[0], a[1])), openFor: jest.fn(async () => ({ id: 'G1', chain_ref: '3', course_id: 'C1' })), get: jest.fn(async () => ({ id: 'G1', chain_ref: '3', course_id: 'C1' })), list: jest.fn(async () => [{ id: 'G1', chain_ref: '7', course_id: 'C1', status: 'active', starts_at: null, teacher_reserve_balance: null, teacher_settled_total: null }]), firstOf: jest.fn(async () => ({ id: 'G1', chain_ref: '7', course_id: 'C1', status: 'active' })), saveFunds: jest.fn(async (g: any, r: string, st: string) => { g.teacher_reserve_balance = r; g.teacher_settled_total = st; return true; }) } as any), chain, courses, enrollments };
}

describe('EdubridgeFundsService — гарантийный срок и удержание', () => {
  it('пока идёт гарантийный срок группы, контракт не вызывается', async () => {
    const { service, chain } = make(courseOf(true), [enrollmentOf()], [chainSub('1000.0000 RUB', false)]);
    await expect(service.unlockDue('voskhod', at(3))).resolves.toBe(0);
    expect(chain.unlockFee).not.toHaveBeenCalled();
  });

  it('курс не активирован — срок впереди, контракт не вызывается', async () => {
    const { service, chain } = make(courseOf(false), [enrollmentOf()], [chainSub('1000.0000 RUB', false)]);
    await service.unlockDue('voskhod', at(30));
    expect(chain.unlockFee).not.toHaveBeenCalled();
  });

  it('срок вышел: unlockfee без суммы, удержанное в записи — то, что оставил контракт', async () => {
    const e = enrollmentOf();
    const { service, chain, enrollments } = make(courseOf(true), [e], [chainSub('1000.0000 RUB', false), chainSub('150.0000 RUB', true)]);
    await expect(service.unlockDue('voskhod', at(15))).resolves.toBe(1);
    expect(chain.unlockFee).toHaveBeenCalledWith({ coopname: 'voskhod', sub_hash: 'aabb' });
    expect(e.locked_amount).toBe('150.0000 RUB');
    expect(enrollments.save).toHaveBeenCalled();
  });

  it('заявление по гарантийным условиям на рассмотрении совета: срок вышел, но взнос заморожен — контракт не вызывается', async () => {
    const e = enrollmentOf();
    const frozen = { locked: '1000.0000 RUB', plan: { version: 1, released: false, claimed: true } };
    const { service, chain } = make(courseOf(true), [e], [frozen]);
    await expect(service.unlockDue('voskhod', at(15))).resolves.toBe(0);
    expect(chain.unlockFee).not.toHaveBeenCalled();
    expect(e.locked_amount).toBe('1000.0000 RUB');
  });

  it('срок уже закрыт: контракт не вызывается, удержанное сверяется с цепью', async () => {
    const e = enrollmentOf({ locked_amount: '150.0000 RUB' });
    const { service, chain } = make(courseOf(true), [e], [chainSub('0.0000 RUB', true)]);
    await expect(service.unlockDue('voskhod', at(40))).resolves.toBe(0);
    expect(chain.unlockFee).not.toHaveBeenCalled();
    expect(e.locked_amount).toBeNull();
  });

  it('подписка открыта до учёта занятий — контракт по ней не вызывается', async () => {
    const { service, chain } = make(courseOf(true), [enrollmentOf()], [{ locked: '1000.0000 RUB' }]);
    await service.unlockDue('voskhod', at(40));
    expect(chain.unlockFee).not.toHaveBeenCalled();
  });

  it('учёт курса в записи берётся из цепи', async () => {
    const course = courseOf(true);
    const { service, courses } = make(course, [], []);
    await service.syncCourse('voskhod', 'C1');
    expect(course.teacher_reserve_balance).toBe('700.0000 RUB');
    expect(courses.save).toHaveBeenCalled();
  });

  it('ошибка по одной подписке остальные не держит', async () => {
    const a = enrollmentOf({ id: 'E1', sub_hash: 'a1' });
    const b = enrollmentOf({ id: 'E2', sub_hash: 'b2' });
    const { service, chain } = make(courseOf(true), [a, b], []);
    chain.readSubscription.mockRejectedValueOnce(new Error('узел недоступен')).mockResolvedValueOnce(chainSub('1000.0000 RUB', false)).mockResolvedValueOnce(chainSub('0.0000 RUB', true));
    await expect(service.unlockDue('voskhod', at(20))).resolves.toBe(1);
  });
});
