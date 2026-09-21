/** Средства программы: удержано не меньше возвратной суммы, резерв преподавателям — до обязательства по курсу. */
import { EdubridgeFundsService } from '~/extensions/edubridge/application/services/edubridge-funds.service';
import { EduEnrollmentPeriod, EduEnrollmentStatus } from '~/extensions/edubridge/domain/enums';

const logger = { setContext: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() } as any;
const DAY = 86400_000;

/** Курс: 8 занятий в месяц по часу, плановая ставка 100 — себестоимость месяца 800; гарантия 14 дней. */
/** Даты закреплены: расчёт возврата шагает календарными месяцами, и «сегодня минус N дней» поплыл бы по календарю. */
const START = new Date('2026-09-01T00:00:00Z');
const PAID_UNTIL = new Date('2026-10-01T00:00:00Z');
const at = (days: number) => new Date(START.getTime() + days * DAY);

const courseOf = (activated: boolean, extra: Record<string, unknown> = {}) => ({
  id: 'C1',
  lessons_per_month: 8,
  lessons_total: 0,
  lesson_minutes: 60,
  planned_hourly_rate: '100.0000 RUB',
  guarantee_days: 14,
  starts_at: activated ? START : null,
  teacher_reserve_balance: null,
  teacher_settled_total: null,
  ...extra,
});

/** Подписка на месяц, оплаченная в день начала занятий. */
const subOf = (_course: any, extra: Record<string, unknown> = {}) => {
  return {
    id: 'E1',
    sub_hash: 'aabb',
    course_id: 'C1',
    status: EduEnrollmentStatus.ACTIVE,
    period: EduEnrollmentPeriod.MONTH,
    paid_amount: '1000.0000 RUB',
    paid_months: 1,
    paid_until: PAID_UNTIL,
    locked_amount: '1000.0000 RUB',
    created_at: START,
    cancelled_at: null,
    ...extra,
  } as any;
};

function make(course: any, rows: any[]) {
  const enrollments = {
    findLocked: jest.fn(async () => rows.filter((r) => r.locked_amount)),
    findByCourse: jest.fn(async () => rows),
    save: jest.fn(async (e: any) => e),
  } as any;
  const courses = { findById: jest.fn(async () => course), save: jest.fn(async (c: any) => c) } as any;
  const chain = {
    unlockFee: jest.fn(async () => ({})),
    allotReserve: jest.fn(async () => ({})),
    freeReserve: jest.fn(async () => ({})),
  } as any;
  return { service: new EdubridgeFundsService(enrollments, courses, chain, logger), chain, courses, enrollments };
}

describe('EdubridgeFundsService — удержание', () => {
  it('пока идёт гарантийный срок курса, удержан весь взнос', async () => {
    const course = courseOf(true);
    const e = subOf(course);
    const { service, chain } = make(course, [e]);
    await expect(service.unlockDue('voskhod', at(3))).resolves.toBe(0);
    expect(chain.unlockFee).not.toHaveBeenCalled();
  });

  it('курс не активирован — срок впереди, взнос удержан', async () => {
    const course = courseOf(false);
    const { service, chain } = make(course, [subOf(course)]);
    await service.unlockDue('voskhod', at(3));
    expect(chain.unlockFee).not.toHaveBeenCalled();
  });

  it('срок вышел: удержанным остаётся ровно то, что участник получит при отказе сейчас', async () => {
    // Прошло 15 дней из 30 — 4 занятия из 8. Остаток 500, возврат при отказе — половина, 250.
    const course = courseOf(true);
    const e = subOf(course);
    const { service, chain } = make(course, [e]);
    await expect(service.unlockDue('voskhod', at(15))).resolves.toBe(1);
    const call = chain.unlockFee.mock.calls[0][0];
    expect(call.amount).toBe('750.0000 RUB');
    expect(e.locked_amount).toBe('250.0000 RUB');
  });

  it('ученик вписался в идущий курс — свои 14 дней гарантии от дня вступления', async () => {
    // Курс идёт с 1 сентября, ученик вписался 20-го: срок курса давно вышел, а его — до 4 октября.
    const course = courseOf(true);
    const e = subOf(course, { joined_at: at(19), paid_until: new Date('2026-10-20T00:00:00Z') });
    const { service, chain } = make(course, [e]);
    await expect(service.unlockDue('voskhod', at(25))).resolves.toBe(0);
    expect(chain.unlockFee).not.toHaveBeenCalled();
    expect(e.locked_amount).toBe('1000.0000 RUB');
  });

  it('личный срок вписавшегося вышел — удержание тает по Положению', async () => {
    const course = courseOf(true);
    const e = subOf(course, { joined_at: at(19), paid_until: new Date('2026-10-20T00:00:00Z') });
    const { service, chain } = make(course, [e]);
    await expect(service.unlockDue('voskhod', at(35))).resolves.toBe(1);
    expect(chain.unlockFee).toHaveBeenCalled();
  });

  it('повторный проход без новых занятий ничего не освобождает', async () => {
    const course = courseOf(true);
    const e = subOf(course, { locked_amount: '250.0000 RUB' });
    const { service, chain } = make(course, [e]);
    await expect(service.unlockDue('voskhod', at(15))).resolves.toBe(0);
    expect(chain.unlockFee).not.toHaveBeenCalled();
  });

  it('оплаченные занятия прошли все — удержание снимается полностью', async () => {
    const course = courseOf(true);
    const e = subOf(course, { locked_amount: '250.0000 RUB' });
    const { service } = make(course, [e]);
    await service.unlockDue('voskhod', at(30));
    expect(e.locked_amount).toBeNull();
  });

  it('сбой цепи оставляет взнос удержанным до следующего прохода', async () => {
    const course = courseOf(true);
    const e = subOf(course);
    const { service, chain } = make(course, [e]);
    chain.unlockFee.mockRejectedValueOnce(new Error('цепь не отвечает'));
    await expect(service.unlockDue('voskhod', at(15))).resolves.toBe(0);
    expect(e.locked_amount).toBe('1000.0000 RUB');
  });
});

describe('EdubridgeFundsService — резерв преподавателям', () => {
  it('из освобождённого резерв добирается до обязательства по курсу, остальное остаётся в фонде', async () => {
    const course = courseOf(true);
    const e = subOf(course);
    const { service, chain } = make(course, [e]);
    await service.unlockDue('voskhod', at(15));
    // Освобождено 750, преподавателю за оплаченный месяц должны 800 — в резерв уходит всё освобождённое.
    expect(chain.unlockFee.mock.calls[0][0].allot).toBe('750.0000 RUB');
    expect(course.teacher_reserve_balance).toBe('750.0000 RUB');
  });

  it('групповой курс: бюджет преподавателя уже закрыт — взнос второго ученика свободен целиком', async () => {
    const course = courseOf(true, { teacher_reserve_balance: '800.0000 RUB' });
    const first = subOf(course, { id: 'E1', sub_hash: 'a1', locked_amount: null });
    const second = subOf(course, { id: 'E2', sub_hash: 'a2' });
    const { service, chain } = make(course, [first, second]);
    await service.unlockDue('voskhod', at(15));
    const call = chain.unlockFee.mock.calls[0][0];
    expect(call.sub_hash).toBe('a2');
    expect(call.allot).toBeUndefined();
    expect(course.teacher_reserve_balance).toBe('800.0000 RUB');
  });

  it('результат преподавателя принят — обязательство и резерв по курсу уменьшаются', async () => {
    const course = courseOf(true, { teacher_reserve_balance: '800.0000 RUB' });
    const { service } = make(course, []);
    await service.onSettled('voskhod', 'C1', '100.0000 RUB');
    expect(course.teacher_reserve_balance).toBe('700.0000 RUB');
    expect(course.teacher_settled_total).toBe('100.0000 RUB');
  });

  it('единственный ученик отменил подписку — резерв под несостоявшиеся занятия возвращается в фонд', async () => {
    const course = courseOf(true, { teacher_reserve_balance: '800.0000 RUB' });
    const e = subOf(course, { status: EduEnrollmentStatus.CANCELLED, cancelled_at: at(15), locked_amount: '250.0000 RUB' });
    const { service, chain } = make(course, [e]);
    await service.afterClosed('voskhod', e);
    // Оплаченное время сократилось до 15 дней: преподавателю должны 400, лишние 400 — обратно в фонд.
    expect(chain.freeReserve).toHaveBeenCalledWith({ coopname: 'voskhod', sub_hash: 'aabb', amount: '400.0000 RUB' });
    expect(course.teacher_reserve_balance).toBe('400.0000 RUB');
    expect(e.locked_amount).toBeNull();
  });

  it('подписка истекла с удержанным остатком — из него резерв добирается до обязательства', async () => {
    const course = courseOf(true, { teacher_reserve_balance: '600.0000 RUB' });
    const e = subOf(course, { status: EduEnrollmentStatus.EXPIRED, locked_amount: '250.0000 RUB' });
    const { service, chain } = make(course, [e]);
    await service.afterClosed('voskhod', e);
    expect(chain.allotReserve).toHaveBeenCalledWith({ coopname: 'voskhod', sub_hash: 'aabb', amount: '200.0000 RUB' });
    expect(course.teacher_reserve_balance).toBe('800.0000 RUB');
  });

  it('сбой выравнивания резерва закрытие подписки не роняет', async () => {
    const course = courseOf(true, { teacher_reserve_balance: '0.0000 RUB' });
    const e = subOf(course, { status: EduEnrollmentStatus.EXPIRED, locked_amount: '250.0000 RUB' });
    const { service, chain } = make(course, [e]);
    chain.allotReserve.mockRejectedValue(new Error('в фонде недостаточно средств'));
    await expect(service.afterClosed('voskhod', e)).resolves.toBeUndefined();
    expect(e.locked_amount).toBeNull();
  });
});
