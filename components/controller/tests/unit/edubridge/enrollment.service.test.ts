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
  // Себестоимость месяца — 8 часов по 100: из взноса 1000 в резерв выплат преподавателям уходит 800.
  planned_hourly_rate: '100.0000 RUB',
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
  // Копия: отмена по недобору меняет статус курса, общий образец остаётся нетронутым.
  const courses = { findById: jest.fn(async () => ({ ...(opts.course ?? course) })), save: jest.fn(async (c: any) => c) } as any;
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
  return { service, enrollments, courses, chain, events, documents, saved };
}

const doc = { hash: 'DEADBEEF', meta: {}, signatures: [] } as any;

/** Заявление, подписанное по текущей котировке: сервер сверяет его с планом оплаты. */
async function docFor(service: EdubridgeEnrollmentService, period: EduEnrollmentPeriod) {
  const q = await service.quote('voskhod', 'ant', 'L1', 'C1', period);
  return { hash: 'DEADBEEF', meta: { sub_hash: q.sub_hash, total: q.amount, amount: q.to_convert }, signatures: [] } as any;
}

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
    await expect(service.subscribe('voskhod', 'ant', 'L1', 'C1', EduEnrollmentPeriod.MONTH, await docFor(service, EduEnrollmentPeriod.MONTH))).rejects.toThrow(/Пополните главный кошелёк/);
    expect(chain.convertAndSubscribe).not.toHaveBeenCalled();
  });

  it('новая подписка: convert + opensub одной транзакцией, статус ACTIVE, доступ PENDING, событие opened', async () => {
    const { service, chain, events } = make({ available: '20000.0000 RUB' });
    const saved = await service.subscribe('voskhod', 'ant', 'L1', 'C1', EduEnrollmentPeriod.COURSE, await docFor(service, EduEnrollmentPeriod.COURSE));
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
    const saved = await service.subscribe('voskhod', 'ant', 'L1', 'C1', EduEnrollmentPeriod.MONTH, await docFor(service, EduEnrollmentPeriod.MONTH));
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

    await service.subscribe('voskhod', 'ant', 'L1', 'C1', EduEnrollmentPeriod.MONTH, await docFor(service, EduEnrollmentPeriod.MONTH));
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

    await service.subscribe('voskhod', 'ant', 'L1', 'C1', EduEnrollmentPeriod.MONTH, await docFor(service, EduEnrollmentPeriod.MONTH));
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

describe('EdubridgeEnrollmentService — продление и сверка заявления', () => {
  const running = (daysLeft: number, extra: Record<string, unknown> = {}) => ({
    id: 'E9',
    status: EduEnrollmentStatus.ACTIVE,
    paid_until: new Date(Date.now() + daysLeft * 86400_000),
    paid_amount: '1000.0000 RUB',
    paid_months: 1,
    period: EduEnrollmentPeriod.MONTH,
    access_state: EduAccessState.GRANTED,
    learner_id: 'L1',
    course_id: 'C1',
    sub_hash: 'x',
    ...extra,
  });

  it('продление до конца оплаченного срока складывает взносы: возврат считается от всего оплаченного', async () => {
    const { service } = make({ existing: running(10) });
    const saved = await service.subscribe('voskhod', 'ant', 'L1', 'C1', EduEnrollmentPeriod.MONTH, await docFor(service, EduEnrollmentPeriod.MONTH));
    expect(saved.paid_amount).toBe('2000.0000 RUB');
    expect(saved.paid_months).toBe(2);
  });

  it('оплата после истечения срока, пока подписка ещё числится действующей, продлевает её от сегодняшнего дня', async () => {
    const { service, chain } = make({ existing: running(-1) });
    const before = Date.now();
    const saved = await service.subscribe('voskhod', 'ant', 'L1', 'C1', EduEnrollmentPeriod.MONTH, await docFor(service, EduEnrollmentPeriod.MONTH));
    const [, sub] = chain.convertAndSubscribe.mock.calls[0];
    // Запись в цепи ещё жива — opensub ответил бы «уже существует».
    expect(sub.kind).toBe('extend');
    expect(saved.paid_until!.getTime()).toBeGreaterThan(before + 27 * 86400_000);
    // Истёкший срок израсходован целиком: счёт оплаченного начинается заново.
    expect(saved.paid_amount).toBe('1000.0000 RUB');
    expect(saved.paid_months).toBe(1);
  });

  it('снятый с публикации курс: действующая подписка продлевается, новая не открывается', async () => {
    const archived = { ...course, status: EduCourseStatus.ARCHIVED };
    const live = make({ existing: running(10), course: archived });
    await expect(live.service.quote('voskhod', 'ant', 'L1', 'C1', EduEnrollmentPeriod.MONTH)).resolves.toMatchObject({ is_extension: true });
    const fresh = make({ course: archived });
    await expect(fresh.service.quote('voskhod', 'ant', 'L1', 'C1', EduEnrollmentPeriod.MONTH)).rejects.toThrow(/не опубликован/);
  });

  it('заявление подписано при другой раскладке оплаты — отказ, в цепь не ходим', async () => {
    const { service, chain } = make({ available: '20000.0000 RUB' });
    const stale = { hash: 'DEADBEEF', meta: { sub_hash: EdubridgeEnrollmentService.subHash('voskhod', '7', '3'), total: '1000.0000 RUB', amount: '400.0000 RUB' }, signatures: [] } as any;
    await expect(service.subscribe('voskhod', 'ant', 'L1', 'C1', EduEnrollmentPeriod.MONTH, stale)).rejects.toThrow(/сформируйте и подпишите его заново/);
    expect(chain.convertAndSubscribe).not.toHaveBeenCalled();
  });

  it('заявление по другой подписке не принимается', async () => {
    const { service, chain } = make({ available: '20000.0000 RUB' });
    const foreign = { hash: 'DEADBEEF', meta: JSON.stringify({ sub_hash: 'ff', total: '1000.0000 RUB', amount: '1000.0000 RUB' }), signatures: [] } as any;
    await expect(service.subscribe('voskhod', 'ant', 'L1', 'C1', EduEnrollmentPeriod.MONTH, foreign)).rejects.toThrow(/заново/);
    expect(chain.convertAndSubscribe).not.toHaveBeenCalled();
  });
});

describe('EdubridgeEnrollmentService — резерв выплат преподавателям', () => {
  it('из взноса в резерв уходит себестоимость, в фонде остаётся наценка', async () => {
    const { service, chain } = make({ available: '20000.0000 RUB' });
    const saved = await service.subscribe('voskhod', 'ant', 'L1', 'C1', EduEnrollmentPeriod.MONTH, await docFor(service, EduEnrollmentPeriod.MONTH));
    const extras = chain.convertAndSubscribe.mock.calls[0][3];
    expect(extras.allot).toBe('800.0000 RUB');
    expect(saved.reserved_amount).toBe('800.0000 RUB');
  });

  it('скидка за взнос разом съедает наценку, резерв — полная себестоимость оплаченных месяцев', async () => {
    const { service, chain } = make({ available: '20000.0000 RUB' });
    await service.subscribe('voskhod', 'ant', 'L1', 'C1', EduEnrollmentPeriod.COURSE, await docFor(service, EduEnrollmentPeriod.COURSE));
    // Восемь месяцев: взнос 7200 при себестоимости 6400.
    expect(chain.convertAndSubscribe.mock.calls[0][3].allot).toBe('6400.0000 RUB');
  });

  it('резерв не больше самого взноса', async () => {
    const dear = { ...course, planned_hourly_rate: '500.0000 RUB' };
    const { service, chain } = make({ available: '20000.0000 RUB', course: dear });
    await service.subscribe('voskhod', 'ant', 'L1', 'C1', EduEnrollmentPeriod.MONTH, await docFor(service, EduEnrollmentPeriod.MONTH));
    expect(chain.convertAndSubscribe.mock.calls[0][3].allot).toBe('1000.0000 RUB');
  });

  it('взнос целиком с кошелька программы: конвертации нет, заявление публикуется отдельным действием', async () => {
    const { service, chain } = make({ program: '5000.0000 RUB' });
    const document = await docFor(service, EduEnrollmentPeriod.MONTH);
    await service.subscribe('voskhod', 'ant', 'L1', 'C1', EduEnrollmentPeriod.MONTH, document);
    const [convert, , , extras] = chain.convertAndSubscribe.mock.calls[0];
    expect(convert).toBeNull();
    expect(extras.statement).toEqual({ coopname: 'voskhod', username: 'ant', statement: document });
  });

  it('при конвертации заявление несёт convert — отдельно оно не публикуется', async () => {
    const { service, chain } = make({ available: '20000.0000 RUB' });
    await service.subscribe('voskhod', 'ant', 'L1', 'C1', EduEnrollmentPeriod.MONTH, await docFor(service, EduEnrollmentPeriod.MONTH));
    expect(chain.convertAndSubscribe.mock.calls[0][3].statement).toBeUndefined();
  });

  it('продление складывает резерв вместе со взносом', async () => {
    const existing = { id: 'E9', status: EduEnrollmentStatus.ACTIVE, paid_until: new Date(Date.now() + 10 * 86400_000), paid_amount: '1000.0000 RUB', paid_months: 1, reserved_amount: '800.0000 RUB', period: EduEnrollmentPeriod.MONTH, learner_id: 'L1', course_id: 'C1', sub_hash: 'x' };
    const { service } = make({ existing });
    const saved = await service.subscribe('voskhod', 'ant', 'L1', 'C1', EduEnrollmentPeriod.MONTH, await docFor(service, EduEnrollmentPeriod.MONTH));
    expect(saved.reserved_amount).toBe('1600.0000 RUB');
  });

  const paidSub = { id: 'E1', coopname: 'voskhod', member_username: 'ant', learner_id: 'L1', course_id: 'C1', sub_hash: 'aabb', period: EduEnrollmentPeriod.MONTH, paid_amount: '1000.0000 RUB', paid_months: 1, reserved_amount: '800.0000 RUB', status: EduEnrollmentStatus.ACTIVE };

  it('отмена до начала курса и по недобору высвобождает весь резерв: занятия не состоятся', async () => {
    const { service, chain } = make({ existing: { ...paidSub } });
    await service.cancel('voskhod', 'ant', 'E1');
    expect(chain.cancelSubscription.mock.calls[0][1]).toBe('800.0000 RUB');
  });

  it('отказ в ходе обучения высвобождает резерв в доле неиспользованных занятий', async () => {
    // Курс идёт 15 дней из оплаченного месяца: прошло 4 занятия из 8.
    const startsAt = new Date(Date.now() - 15 * 86400_000);
    const running = { ...paidSub, paid_until: new Date(startsAt.getTime() + 30 * 86400_000) };
    const { service, chain } = make({ existing: running, course: { ...course, starts_at: startsAt } });
    await service.cancel('voskhod', 'ant', 'E1');
    const [payload, freed] = chain.cancelSubscription.mock.calls[0];
    expect(payload.refund).toBe('250.0000 RUB');
    expect(freed).toBe('400.0000 RUB');
  });

  it('подписка, открытая до введения резерва, отменяется без высвобождения', async () => {
    const { service, chain } = make({ existing: { ...paidSub, reserved_amount: null } });
    await service.cancel('voskhod', 'ant', 'E1');
    expect(chain.cancelSubscription.mock.calls[0][1]).toBeUndefined();
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

  it('отмена по недобору снимает курс с публикации: на отменённый курс больше не подписаться', async () => {
    const { service, courses } = make({ existing: { ...paid } });
    await service.cancelCourse('voskhod', 'C1');
    expect(courses.save).toHaveBeenCalledWith(expect.objectContaining({ status: EduCourseStatus.ARCHIVED }));
  });

  it('отмена по недобору: сбой по одной подписке не обрывает остальные, итог сообщает, сколько осталось', async () => {
    const { service, chain, enrollments } = make({ existing: { ...paid } });
    enrollments.findByCourse.mockResolvedValue([{ ...paid, id: 'E1', sub_hash: 'a1' }, { ...paid, id: 'E2', sub_hash: 'a2' }, { ...paid, id: 'E3', sub_hash: 'a3' }]);
    chain.cancelSubscription.mockImplementation(async (d: any) => {
      if (d.sub_hash === 'a2') throw new Error('цепь не отвечает');
      return { transaction_id: 'T' };
    });
    await expect(service.cancelCourse('voskhod', 'C1')).rejects.toThrow(/Возвращено подписок: 2, не удалось: 1/);
    expect(chain.cancelSubscription).toHaveBeenCalledTimes(3);
  });

  it('продлённая до старта подписка при недоборе возвращается целиком — оба взноса', async () => {
    const twice = { ...paid, paid_amount: '2000.0000 RUB', paid_months: 2 };
    const { service, chain } = make({ existing: twice });
    await service.cancelCourse('voskhod', 'C1');
    expect(chain.cancelSubscription.mock.calls[0][0].refund).toBe('2000.0000 RUB');
  });

  it('отмена по недобору после начала занятий отклоняется', async () => {
    const started = { ...course, starts_at: '2026-01-01' };
    const { service, chain } = make({ existing: { ...paid }, course: started });
    await expect(service.cancelCourse('voskhod', 'C1')).rejects.toThrow(/занятия по курсу уже начались/i);
    expect(chain.cancelSubscription).not.toHaveBeenCalled();
  });
});
