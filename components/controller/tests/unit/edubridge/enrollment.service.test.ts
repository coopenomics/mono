/** «Получить доступ»: котировка, взнос помесячно и разом за весь курс, продление против открытия, нехватка паевого, одна транзакция convert+opensub. */
import { EdubridgeEnrollmentService } from '~/extensions/edubridge/application/services/edubridge-enrollment.service';
import { EduAccessState, EduCourseStatus, EduEnrollmentPeriod, EduEnrollmentStatus } from '~/extensions/edubridge/domain/enums';
import { EDUBRIDGE_ENROLLMENT_EXTENDED_EVENT, EDUBRIDGE_ENROLLMENT_OPENED_EVENT } from '~/extensions/edubridge/application/events/edubridge.events';

const logger = { setContext: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() } as any;
const learner = { id: 'L1', chain_ref: '7', member_username: 'ant', recipient_type: 'email', recipient_value: 'kid@x.ru' } as any;
const course = {
  id: 'C1',
  chain_ref: '3',
  title: 'Алгебра',
  status: EduCourseStatus.PUBLISHED,
  fee_month: '1000.0000 RUB',
  // Взнос за весь курс разом принимается, скидка 10%: программа 64 занятия по 8 в месяц — восемь месяцев.
  course_payment_enabled: true,
  course_discount_bp: 1000,
  lessons_per_month: 8,
  lessons_total: 64,
  lesson_minutes: 60,
  starts_at: null,
} as any;

function make(opts: { existing?: any; available?: string; program?: string; course?: any } = {}) {
  const saved: any[] = [];
  const enrollments = {
    findByPair: jest.fn(async () => opts.existing ?? null),
    findById: jest.fn(async () => opts.existing ?? null),
    findByCourse: jest.fn(async () => (opts.existing ? [opts.existing] : [])),
    create: jest.fn((d: any) => ({ ...d })),
    save: jest.fn(async (e: any) => { saved.push(e); return { ...e, id: e.id ?? 'E1' }; }),
  } as any;
  const courses = { findById: jest.fn(async () => opts.course ?? course) } as any;
  const learnerService = { getOwned: jest.fn(async () => learner) } as any;
  const chain = {
    convertAndSubscribe: jest.fn(async () => ({ transaction_id: 'TRX1' })),
    cancelSubscription: jest.fn(async () => ({ transaction_id: 'TRX2' })),
  } as any;
  const documents = { generate: jest.fn(async () => ({ hash: 'ABC', html: '', full_title: '', binary: '', meta: {} })) } as any;
  // Кошелёк программы и главный паевой: взнос берётся сначала с программы.
  const wallets = {
    findByWalletAndUsername: jest.fn(async (_coopname: string, wallet: string) => ({
      available: wallet === 'w.edu.member' ? (opts.program ?? '0.0000 RUB') : (opts.available ?? '5000.0000 RUB'),
    })),
  } as any;
  const events = { emit: jest.fn() } as any;
  const service = new EdubridgeEnrollmentService(enrollments, courses, learnerService, chain, documents, wallets, logger, events);
  return { service, enrollments, chain, events, documents, saved };
}

const doc = { hash: 'DEADBEEF', meta: {}, signatures: [] } as any;

describe('EdubridgeEnrollmentService', () => {
  it('котировка: сумма по периоду, хватает ли паевого, ключ подписки детерминирован', async () => {
    const { service } = make({ available: '500.0000 RUB' });
    const q = await service.quote('voskhod', 'ant', 'L1', 'C1', EduEnrollmentPeriod.MONTH);
    expect(q.amount).toBe('1000.0000 RUB');
    expect(q.enough).toBe(false);
    expect(q.shortfall).toBe('500.0000 RUB');
    expect(q.months).toBe(1);
    expect(q.discount_amount).toBe('0.0000 RUB');
    expect(q.from_program).toBe('0.0000 RUB');
    expect(q.to_convert).toBe('1000.0000 RUB');
    expect(q.is_extension).toBe(false);
    expect(q.sub_hash).toBe(EdubridgeEnrollmentService.subHash('voskhod', '7', '3'));
  });

  it('нехватка паевого — отказ с подсказкой пополнить, в цепь не ходим', async () => {
    const { service, chain } = make({ available: '10.0000 RUB' });
    await expect(service.subscribe('voskhod', 'ant', 'L1', 'C1', EduEnrollmentPeriod.MONTH, doc)).rejects.toThrow(/Пополните главный кошелёк/);
    expect(chain.convertAndSubscribe).not.toHaveBeenCalled();
  });

  it('новая подписка: convert + opensub одной транзакцией, статус ACTIVE, доступ PENDING, событие opened', async () => {
    const { service, chain, events } = make({ available: '20000.0000 RUB' });
    const saved = await service.subscribe('voskhod', 'ant', 'L1', 'C1', EduEnrollmentPeriod.COURSE, doc);
    const [convert, sub, charge] = chain.convertAndSubscribe.mock.calls[0];
    // Восемь месяцев по 1000 со скидкой 10%.
    expect(convert.amount).toBe('7200.0000 RUB');
    // Взнос уходит в фонд той же транзакцией: стоимость подписки поступает
    // в распоряжение кооператива сразу (Положение ЦПП, п. 4.2.2).
    expect(charge.amount).toBe('7200.0000 RUB');
    expect(charge.sub_hash).toBe(sub.data.sub_hash);
    expect(charge.username).toBe('ant');
    expect(sub.kind).toBe('open');
    expect(sub.data.learner_id).toBe(7);
    expect(sub.data.period).toBe('course');
    expect(saved.paid_months).toBe(8);
    expect(saved.paid_amount).toBe('7200.0000 RUB');
    expect(saved.status).toBe(EduEnrollmentStatus.ACTIVE);
    expect(saved.access_state).toBe(EduAccessState.PENDING);
    expect(saved.statement_hash).toBe('deadbeef');
    expect(events.emit).toHaveBeenCalledWith(EDUBRIDGE_ENROLLMENT_OPENED_EVENT, expect.objectContaining({ trx_id: 'TRX1' }));
  });

  it('действующая подписка: extendsub от текущего paid_until, событие extended, доступ не трогаем', async () => {
    const until = new Date(Date.now() + 10 * 86400_000);
    const existing = { id: 'E9', status: EduEnrollmentStatus.ACTIVE, paid_until: until, access_state: EduAccessState.GRANTED, learner_id: 'L1', course_id: 'C1', sub_hash: 'x' };
    const { service, chain, events } = make({ existing });
    const saved = await service.subscribe('voskhod', 'ant', 'L1', 'C1', EduEnrollmentPeriod.MONTH, doc);
    const [, sub] = chain.convertAndSubscribe.mock.calls[0];
    expect(sub.kind).toBe('extend');
    const expected = new Date(until); expected.setMonth(expected.getMonth() + 1);
    expect(saved.paid_until?.getTime()).toBe(expected.getTime());
    expect(saved.access_state).toBe(EduAccessState.GRANTED);
    expect(events.emit).toHaveBeenCalledWith(EDUBRIDGE_ENROLLMENT_EXTENDED_EVENT, expect.anything());
  });

  it('взнос за весь курс: пришедший в середине вносит за оставшиеся месяцы, срок — до конца курса', async () => {
    // Курс начался пять с половиной месяцев назад: из восьми месяцев осталось три (неполный считается месяцем).
    const startsAt = new Date(); startsAt.setMonth(startsAt.getMonth() - 5); startsAt.setDate(startsAt.getDate() - 10);
    const { service } = make({ available: '20000.0000 RUB', course: { ...course, starts_at: startsAt } });
    const q = await service.quote('voskhod', 'ant', 'L1', 'C1', EduEnrollmentPeriod.COURSE);
    expect(q.months).toBe(3);
    expect(q.base_amount).toBe('3000.0000 RUB');
    expect(q.discount_amount).toBe('300.0000 RUB');
    expect(q.amount).toBe('2700.0000 RUB');
    const end = new Date(startsAt); end.setMonth(end.getMonth() + 8);
    expect(q.paid_until.getTime()).toBe(end.getTime());
  });

  it('взнос за весь курс после помесячного: оплаченный месяц засчитан, взнос — за остаток', async () => {
    const until = new Date(); until.setMonth(until.getMonth() + 1);
    const existing = { id: 'E9', status: EduEnrollmentStatus.ACTIVE, paid_until: until, access_state: EduAccessState.GRANTED, learner_id: 'L1', course_id: 'C1', sub_hash: 'x' };
    const startsAt = new Date(until); startsAt.setMonth(startsAt.getMonth() - 1);
    const { service } = make({ existing, course: { ...course, starts_at: startsAt } });
    const q = await service.quote('voskhod', 'ant', 'L1', 'C1', EduEnrollmentPeriod.COURSE);
    expect(q.is_extension).toBe(true);
    expect(q.months).toBe(7);
  });

  it('курс оплачен до конца программы — повторный взнос за курс не принимается', async () => {
    const startsAt = new Date(); startsAt.setMonth(startsAt.getMonth() - 1);
    const until = new Date(startsAt); until.setMonth(until.getMonth() + 8);
    const existing = { id: 'E9', status: EduEnrollmentStatus.ACTIVE, paid_until: until, access_state: EduAccessState.GRANTED, learner_id: 'L1', course_id: 'C1', sub_hash: 'x' };
    const { service } = make({ existing, course: { ...course, starts_at: startsAt } });
    await expect(service.quote('voskhod', 'ant', 'L1', 'C1', EduEnrollmentPeriod.COURSE)).rejects.toThrow(/оплачен до конца программы/);
  });

  it('кооператив принимает только помесячный взнос — взнос за курс отклоняется', async () => {
    const { service } = make({ course: { ...course, course_payment_enabled: false } });
    await expect(service.quote('voskhod', 'ant', 'L1', 'C1', EduEnrollmentPeriod.COURSE)).rejects.toThrow(/доступен помесячный взнос/);
  });

  it('курс без конечной программы — взнос за курс отклоняется', async () => {
    const { service } = make({ course: { ...course, lessons_total: 0 } });
    await expect(service.quote('voskhod', 'ant', 'L1', 'C1', EduEnrollmentPeriod.COURSE)).rejects.toThrow(/доступен помесячный взнос/);
  });

  it('взнос за год больше не оформляется', async () => {
    const { service } = make();
    await expect(service.quote('voskhod', 'ant', 'L1', 'C1', EduEnrollmentPeriod.YEAR)).rejects.toThrow(/за год больше не принимается/);
  });

  it('остаток кошелька программы покрывает взнос целиком: конвертации нет', async () => {
    const { service, chain } = make({ program: '5000.0000 RUB', available: '0.0000 RUB' });
    const q = await service.quote('voskhod', 'ant', 'L1', 'C1', EduEnrollmentPeriod.MONTH);
    expect(q.from_program).toBe('1000.0000 RUB');
    expect(q.to_convert).toBe('0.0000 RUB');
    expect(q.enough).toBe(true);

    await service.subscribe('voskhod', 'ant', 'L1', 'C1', EduEnrollmentPeriod.MONTH, doc);
    const [convert, , charge] = chain.convertAndSubscribe.mock.calls[0];
    expect(convert).toBeNull();
    // В фонд программы уходит полная стоимость подписки.
    expect(charge.amount).toBe('1000.0000 RUB');
  });

  it('остаток кошелька программы покрывает часть: с паевого конвертируется недостача', async () => {
    const { service, chain } = make({ program: '400.0000 RUB' });
    const q = await service.quote('voskhod', 'ant', 'L1', 'C1', EduEnrollmentPeriod.MONTH);
    expect(q.from_program).toBe('400.0000 RUB');
    expect(q.to_convert).toBe('600.0000 RUB');

    await service.subscribe('voskhod', 'ant', 'L1', 'C1', EduEnrollmentPeriod.MONTH, doc);
    const [convert, , charge] = chain.convertAndSubscribe.mock.calls[0];
    expect(convert.amount).toBe('600.0000 RUB');
    expect(charge.amount).toBe('1000.0000 RUB');
  });

  it('заявление о конвертации называет зачёт и конвертацию', async () => {
    const { service, documents } = make({ program: '400.0000 RUB' });
    await service.statement('voskhod', 'ant', 'L1', 'C1', EduEnrollmentPeriod.MONTH);
    const data = documents.generate.mock.calls[0][0].data;
    expect(data.from_program).toBe('400.0000 RUB');
    expect(data.amount).toBe('600.0000 RUB');
    expect(data.total).toBe('1000.0000 RUB');
  });

  it('заявление о конвертации — документ 3011 с ключом подписки, суммой, курсом и периодом', async () => {
    const { service, documents } = make();
    await service.statement('voskhod', 'ant', 'L1', 'C1', EduEnrollmentPeriod.MONTH);
    const data = documents.generate.mock.calls[0][0].data;
    expect(data.registry_id).toBe(3011);
    expect(data.course_title).toBe('Алгебра');
    expect(data.period).toBe('month');
    expect(data.amount).toBe('1000.0000 RUB');
  });
});

describe('EdubridgeEnrollmentService — отмена подписки', () => {
  const paid = {
    id: 'E1',
    coopname: 'voskhod',
    member_username: 'ant',
    learner_id: 'L1',
    course_id: 'C1',
    sub_hash: 'aabb',
    period: EduEnrollmentPeriod.MONTH,
    paid_amount: '9600.0000 RUB',
    status: EduEnrollmentStatus.ACTIVE,
    access_state: EduAccessState.GRANTED,
  };

  it('до активации курса подписка отменяется с полным возвратом на кошелёк программы', async () => {
    const { service, chain } = make({ existing: { ...paid } });
    const saved = await service.cancel('voskhod', 'ant', 'E1');
    const [payload] = chain.cancelSubscription.mock.calls[0];
    expect(payload.refund).toBe('9600.0000 RUB');
    expect(payload.to_share).toBe(false);
    expect(saved.status).toBe(EduEnrollmentStatus.CANCELLED);
    expect(saved.refunded_amount).toBe('9600.0000 RUB');
  });

  it('чужую подписку отменить нельзя', async () => {
    const { service, chain } = make({ existing: { ...paid, member_username: 'other' } });
    await expect(service.cancel('voskhod', 'ant', 'E1')).rejects.toThrow(/не найдена/);
    expect(chain.cancelSubscription).not.toHaveBeenCalled();
  });

  it('повторная отмена отклоняется', async () => {
    const { service, chain } = make({ existing: { ...paid, status: EduEnrollmentStatus.CANCELLED } });
    await expect(service.cancel('voskhod', 'ant', 'E1')).rejects.toThrow(/уже отменена/);
    expect(chain.cancelSubscription).not.toHaveBeenCalled();
  });

  it('отмена по недобору закрывает подписки курса и возвращает взносы на паевой', async () => {
    const { service, chain } = make({ existing: { ...paid } });
    const cancelled = await service.cancelCourse('voskhod', 'C1');
    expect(cancelled).toHaveLength(1);
    const [payload] = chain.cancelSubscription.mock.calls[0];
    expect(payload.to_share).toBe(true);
    expect(payload.refund).toBe('9600.0000 RUB');
  });

  it('отмена по недобору после начала занятий отклоняется', async () => {
    const started = { ...course, starts_at: '2026-01-01' };
    const { service, chain } = make({ existing: { ...paid }, course: started });
    await expect(service.cancelCourse('voskhod', 'C1')).rejects.toThrow(/занятия по курсу уже начались/i);
    expect(chain.cancelSubscription).not.toHaveBeenCalled();
  });
});
