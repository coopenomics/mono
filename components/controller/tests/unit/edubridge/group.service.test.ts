/** Группа — единица расчёта: снимок условий курса, свой номер в цепи, набор, привязка к площадке. */
import { EdubridgeGroupService } from '~/extensions/edubridge/application/services/edubridge-group.service';
import { chainAssignmentRef, targetFeeMonth } from '~/extensions/edubridge/application/services/edubridge-chain-terms.service';
import { EduEnrollmentStatus, EduGroupStatus } from '~/extensions/edubridge/domain/enums';

const logger = { setContext: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() } as any;

const course = {
  id: 'C1',
  coopname: 'voskhod',
  chain_ref: '3',
  title: 'Алгебра',
  external_ref: 'course-uuid',
  starts_at: '2026-09-01',
  lessons_per_month: 8,
  lessons_total: 64,
  lesson_minutes: 60,
  planned_hourly_rate: '300.0000 RUB',
  pay_per_learner: true,
  guarantee_days: 14,
  course_payment_enabled: true,
  course_discount_bp: 1000,
  fee_month: '3000.0000 RUB',
} as any;

function make(opts: { groups?: any[]; enrollments?: any[]; lessons?: any[]; course?: any } = {}) {
  const store: any[] = [...(opts.groups ?? [])];
  let seq = 1000;
  const groups = {
    findById: jest.fn(async (_c: string, id: string) => store.find((g) => g.id === id) ?? null),
    findByCourse: jest.fn(async () => store),
    create: jest.fn((d: any) => ({ ...d })),
    save: jest.fn(async (g: any) => {
      if (!g.id) Object.assign(g, { id: `G${store.length + 1}`, chain_ref: String(++seq) });
      if (!store.includes(g)) store.push(g);
      return g;
    }),
  } as any;
  // Запись курса своя на каждый случай: служба правит у неё дату начала по группам.
  const record = { ...(opts.course ?? course) };
  const courses = { findById: jest.fn(async () => record), listAll: jest.fn(async () => [record]), save: jest.fn(async (c: any) => c) } as any;
  const enrollments = { findByGroup: jest.fn(async () => opts.enrollments ?? []) } as any;
  const lessons = { findByGroup: jest.fn(async () => opts.lessons ?? []) } as any;
  const chainTerms = { pushCourse: jest.fn(async () => undefined), tryPushCourse: jest.fn(async () => true) } as any;
  return { service: new EdubridgeGroupService(groups, courses, enrollments, lessons, chainTerms, logger), store, chainTerms, groups, record, courses };
}

const group = (extra: Record<string, unknown> = {}) => ({
  id: 'G1',
  coopname: 'voskhod',
  chain_ref: '3',
  course_id: 'C1',
  title: 'Группа 1',
  status: EduGroupStatus.ACTIVE,
  enrollment_open: true,
  enrollment_closed_on_start: false,
  external_ref: 'course-uuid:group-a',
  // Занятия группы ещё не начались: набор открыт.
  starts_at: '2099-09-01',
  lessons_per_month: 8,
  lessons_total: 64,
  lesson_minutes: 60,
  planned_hourly_rate: '300.0000 RUB',
  pay_per_learner: true,
  guarantee_days: 14,
  course_payment_enabled: true,
  course_discount_bp: 1000,
  fee_month: '3000.0000 RUB',
  teacher_reserve_balance: '700.0000 RUB',
  teacher_settled_total: null,
  ...extra,
});

describe('EdubridgeGroupService — группа как единица расчёта', () => {
  it('новая группа берёт условия курса снимком и уходит в цепь под своим номером', async () => {
    const { service, chainTerms } = make({ groups: [group()] });
    const created = await service.create('voskhod', { course_id: 'C1', starts_at: '2027-01-10', external_ref: 'course-uuid:group-b' });
    expect(created).toMatchObject({ title: 'Группа 2', fee_month: '3000.0000 RUB', planned_hourly_rate: '300.0000 RUB', pay_per_learner: true, starts_at: '2027-01-10', external_ref: 'course-uuid:group-b' });
    // В цепь уходит курс глазами группы: номер, дата начала и привязка — её.
    expect(chainTerms.pushCourse).toHaveBeenCalledWith(expect.objectContaining({ chain_ref: created.chain_ref, starts_at: '2027-01-10', id: 'C1' }));
  });

  it('первая группа курса наследует его дату начала и привязку к площадке', async () => {
    const { service } = make();
    const first = await service.create('voskhod', { course_id: 'C1' });
    expect(first).toMatchObject({ title: 'Группа 1', starts_at: '2026-09-01', external_ref: 'course-uuid' });
  });

  it('курс глазами группы: условия, номер для цепи, дата начала, привязка и учёт — группы; программа — курса', () => {
    const { service } = make();
    const view = service.viewOf(course, group({ chain_ref: '1001', fee_month: '4000.0000 RUB', starts_at: '2027-01-10' }) as any);
    expect(view).toMatchObject({ id: 'C1', title: 'Алгебра', chain_ref: '1001', fee_month: '4000.0000 RUB', starts_at: '2027-01-10', external_ref: 'course-uuid:group-a', teacher_reserve_balance: '700.0000 RUB' });
  });

  it('запись идёт в единственную группу с открытым набором; при нескольких группу выбирают; закрытый набор отклоняется', async () => {
    const one = make({ groups: [group()] });
    await expect(one.service.openFor('voskhod', course)).resolves.toMatchObject({ id: 'G1' });
    const two = make({ groups: [group(), group({ id: 'G2', chain_ref: '1001' })] });
    await expect(two.service.openFor('voskhod', course)).rejects.toMatchObject({ code: 'EDUBRIDGE_GROUP_CHOICE_REQUIRED' });
    await expect(two.service.openFor('voskhod', course, 'G2')).resolves.toMatchObject({ id: 'G2' });
    const closed = make({ groups: [group({ enrollment_open: false })] });
    await expect(closed.service.openFor('voskhod', course)).rejects.toMatchObject({ code: 'EDUBRIDGE_GROUP_ENROLLMENT_CLOSED' });
    await expect(closed.service.openFor('voskhod', course, 'G1')).rejects.toMatchObject({ code: 'EDUBRIDGE_GROUP_ENROLLMENT_CLOSED' });
  });

  it('набор в группу закрывается сам с дня начала занятий; администратор открывает его снова, и сам он уже не закрывается', async () => {
    const started = make({ groups: [group({ starts_at: '2026-09-01' })] });
    await expect(started.service.openFor('voskhod', course)).rejects.toMatchObject({ code: 'EDUBRIDGE_GROUP_ENROLLMENT_CLOSED' });
    await expect(started.service.openFor('voskhod', course, 'G1')).rejects.toMatchObject({ code: 'EDUBRIDGE_GROUP_ENROLLMENT_CLOSED' });
    expect(started.store[0]).toMatchObject({ enrollment_open: false, enrollment_closed_on_start: true });
    // Исключение: администратор принимает участника в идущую группу.
    await expect(started.service.update('voskhod', { id: 'G1', enrollment_open: true })).resolves.toMatchObject({ enrollment_open: true });
    await expect(started.service.openFor('voskhod', course)).resolves.toMatchObject({ id: 'G1' });
    await expect(started.service.list('voskhod', 'C1')).resolves.toEqual([expect.objectContaining({ enrollment_open: true })]);
  });

  it('группа без даты начала и группа с будущим началом набор не закрывают; новая группа с наступившим началом открывается с закрытым набором', async () => {
    const waiting = make({ groups: [group({ starts_at: null }), group({ id: 'G2', chain_ref: '1001' })] });
    await expect(waiting.service.list('voskhod', 'C1')).resolves.toEqual([expect.objectContaining({ enrollment_open: true }), expect.objectContaining({ enrollment_open: true })]);
    const late = make({ groups: [group()] });
    await expect(late.service.create('voskhod', { course_id: 'C1', starts_at: '2026-09-01' })).resolves.toMatchObject({ enrollment_open: false, enrollment_closed_on_start: true });
  });

  it('начало перенесено на будущий день: набор, закрытый по началу, снова открыт и закроется в новый день начала', async () => {
    const moved = make({ groups: [group({ starts_at: '2026-09-01' })] });
    await moved.service.list('voskhod', 'C1');
    await expect(moved.service.update('voskhod', { id: 'G1', starts_at: '2099-01-10' })).resolves.toMatchObject({ starts_at: '2099-01-10', enrollment_open: true, enrollment_closed_on_start: false });
  });

  it('дата начала у курса — ближайшая группа с открытым набором; без набора — самая поздняя дата идущих групп', async () => {
    const two = make({ groups: [group({ starts_at: '2026-09-01' }), group({ id: 'G2', chain_ref: '1001', starts_at: '2099-03-01' })] });
    // Вторая группа перенесена ближе: курс показывает её день, начавшаяся первая набор уже закрыла.
    await two.service.update('voskhod', { id: 'G2', starts_at: '2099-02-01' });
    expect(two.record.starts_at).toBe('2099-02-01');
    expect(two.courses.save).toHaveBeenCalled();
    // Набор во вторую закрыт администратором — открытых групп нет, остаётся самая поздняя дата.
    await two.service.update('voskhod', { id: 'G2', enrollment_open: false });
    expect(two.record.starts_at).toBe('2099-02-01');
  });

  it('группа на площадке, заданная в панели группы, переживает правку курса; смена курса площадки привязку меняет', async () => {
    const kept = make({ groups: [group({ external_ref: 'course-uuid:group-b' })] });
    await kept.service.applyCourseTerms('voskhod', { ...course, external_ref: 'course-uuid:group-a' });
    expect(kept.store[0].external_ref).toBe('course-uuid:group-b');
    const moved = make({ groups: [group({ external_ref: 'course-uuid:group-b' })] });
    await moved.service.applyCourseTerms('voskhod', { ...course, external_ref: 'other-course' });
    expect(moved.store[0].external_ref).toBe('other-course');
  });

  it('условия курса изменены: группа без взносов и занятий берёт новые, группа с участниками остаётся на прежних', async () => {
    const changed = { ...course, fee_month: '5000.0000 RUB', planned_hourly_rate: '500.0000 RUB' };
    const fresh = make({ groups: [group()], course: changed });
    await fresh.service.applyCourseTerms('voskhod', changed);
    expect(fresh.store[0]).toMatchObject({ fee_month: '5000.0000 RUB', planned_hourly_rate: '500.0000 RUB' });
    expect(fresh.chainTerms.pushCourse).toHaveBeenCalled();
    const taken = make({ groups: [group()], course: changed, enrollments: [{ status: EduEnrollmentStatus.ACTIVE }] });
    await taken.service.applyCourseTerms('voskhod', changed);
    expect(taken.store[0].fee_month).toBe('3000.0000 RUB');
    expect(taken.chainTerms.pushCourse).not.toHaveBeenCalled();
  });

  it('дата начала группы не меняется после первого занятия; до него — меняется и уходит в цепь', async () => {
    const held = make({ groups: [group()], lessons: [{ id: 'L1' }] });
    await expect(held.service.update('voskhod', { id: 'G1', starts_at: '2026-10-01' })).rejects.toMatchObject({ code: 'EDUBRIDGE_COURSE_START_LOCKED_BY_LESSONS' });
    const fresh = make({ groups: [group()] });
    await expect(fresh.service.update('voskhod', { id: 'G1', starts_at: '2026-10-01', enrollment_open: false })).resolves.toMatchObject({ starts_at: '2026-10-01', enrollment_open: false });
    expect(fresh.chainTerms.pushCourse).toHaveBeenCalledWith(expect.objectContaining({ starts_at: '2026-10-01' }));
  });

  it('начало через N минут называется только при сжатом времени стенда: момент с минутами уходит в цепь, дата его сбрасывает', async () => {
    const mode = (value: string | undefined) => ((process.env as Record<string, string | undefined>).NODE_ENV = value);
    const previous = process.env.NODE_ENV;
    try {
      // Вне стенда разработки начало называется датой.
      const real = make({ groups: [group()] });
      await expect(real.service.update('voskhod', { id: 'G1', starts_in_minutes: 3 })).rejects.toMatchObject({ code: 'EDUBRIDGE_START_IN_MINUTES_STAND_ONLY' });
      mode('development');
      const stand = make({ groups: [group()] });
      const before = Date.now();
      const moved = await stand.service.update('voskhod', { id: 'G1', starts_in_minutes: 3 });
      const moment = new Date(moved.starts_at_time as Date).getTime();
      expect(moment).toBeGreaterThanOrEqual(before + 180_000);
      expect(moment).toBeLessThanOrEqual(Date.now() + 180_000);
      expect(moved.starts_at).toBe(new Date(moment).toISOString().slice(0, 10));
      // Расчёты и цепь видят момент, а не начало дня; набор до него открыт.
      expect(stand.chainTerms.pushCourse).toHaveBeenLastCalledWith(expect.objectContaining({ starts_at: new Date(moment).toISOString() }));
      expect(moved.enrollment_open).toBe(true);
      // Дата, названная после, момент сбрасывает.
      await expect(stand.service.update('voskhod', { id: 'G1', starts_at: '2099-12-01' })).resolves.toMatchObject({ starts_at: '2099-12-01', starts_at_time: null });
    } finally {
      mode(previous);
    }
  });

  it('срок программы вышел, а расчёты по истёкшей подписке открыты — группа идёт: преподаватель ещё отчитывается о занятиях', async () => {
    const open = { status: EduEnrollmentStatus.EXPIRED, chain_close_after: new Date('2025-10-01') };
    const waiting = make({ groups: [group({ starts_at: '2025-01-10' })], enrollments: [open] });
    await expect(waiting.service.list('voskhod', 'C1')).resolves.toEqual([expect.objectContaining({ status: EduGroupStatus.ACTIVE })]);
    // Расчёты закрыты — группа завершается сама.
    const closed = make({ groups: [group({ starts_at: '2025-01-10' })], enrollments: [{ status: EduEnrollmentStatus.EXPIRED, chain_close_after: null }] });
    await expect(closed.service.list('voskhod', 'C1')).resolves.toEqual([expect.objectContaining({ status: EduGroupStatus.CLOSED })]);
  });

  it('администратор завершает группу без действующих подписок; с действующей подпиской и завершённую повторно — отказ', async () => {
    const idle = make({ groups: [group({ starts_at: '2025-01-10' })], enrollments: [{ status: EduEnrollmentStatus.EXPIRED, chain_close_after: new Date('2025-10-01') }] });
    await expect(idle.service.finish('voskhod', 'G1')).resolves.toMatchObject({ status: EduGroupStatus.CLOSED, enrollment_open: false });
    await expect(idle.service.finish('voskhod', 'G1')).rejects.toMatchObject({ code: 'EDUBRIDGE_GROUP_NOT_ACTIVE' });
    const busy = make({ groups: [group()], enrollments: [{ status: EduEnrollmentStatus.ACTIVE }] });
    await expect(busy.service.finish('voskhod', 'G1')).rejects.toMatchObject({ code: 'EDUBRIDGE_GROUP_FINISH_LIVE_SUBSCRIPTIONS' });
  });

  it('подписку можно продлить у программы длиннее месяца, пока она идёт после оплаченного срока; программу в один месяц и оплаченную до конца — нельзя', async () => {
    // 16 занятий по 8 в месяц — программа в два месяца: с 01.09.2099 по 01.11.2099.
    const { service } = make({ groups: [group({ lessons_total: 16 })] });
    const sub = (paid: string | null, groupId: string | null = 'G1') => ({ coopname: 'voskhod', group_id: groupId, paid_until: paid ? new Date(paid) : null }) as any;
    await expect(service.isRenewable(sub('2099-10-01'))).resolves.toBe(true);
    await expect(service.isRenewable(sub('2099-11-01'))).resolves.toBe(false);
    // Программа в один месяц оплачивается одним взносом: продления нет, даже когда оплаченный срок кончается раньше программы.
    await expect(make({ groups: [group({ lessons_total: 8 })] }).service.isRenewable(sub('2099-09-20'))).resolves.toBe(false);
    // Программа без конца продлевается всегда; завершённая группа — никогда.
    await expect(make({ groups: [group({ lessons_total: 0 })] }).service.isRenewable(sub('2199-01-01'))).resolves.toBe(true);
    await expect(make({ groups: [group({ status: EduGroupStatus.CLOSED })] }).service.isRenewable(sub('2099-09-20'))).resolves.toBe(false);
    await expect(service.isRenewable(sub('2099-09-20', null))).resolves.toBe(true);
  });

  it('группа завершается сама, когда срок программы вышел и действующих подписок нет; с действующей подпиской она идёт дальше', async () => {
    // 64 занятия по 8 в месяц — восемь месяцев от дня начала.
    const over = make({ groups: [group({ starts_at: '2025-01-10' })], enrollments: [{ status: EduEnrollmentStatus.EXPIRED }] });
    await expect(over.service.list('voskhod', 'C1')).resolves.toEqual([expect.objectContaining({ status: EduGroupStatus.CLOSED, enrollment_open: false })]);
    await expect(over.service.openFor('voskhod', course, 'G1')).rejects.toMatchObject({ code: 'EDUBRIDGE_GROUP_ENROLLMENT_CLOSED' });
    const busy = make({ groups: [group({ starts_at: '2025-01-10' })], enrollments: [{ status: EduEnrollmentStatus.ACTIVE }] });
    await expect(busy.service.list('voskhod', 'C1')).resolves.toEqual([expect.objectContaining({ status: EduGroupStatus.ACTIVE, enrollment_open: false })]);
    // Срок программы ещё идёт, и группа без конечной программы не заканчивается.
    const running = make({ groups: [group({ starts_at: '2026-09-01' }), group({ id: 'G2', starts_at: '2020-01-10', lessons_total: 0 })] });
    await expect(running.service.list('voskhod', 'C1')).resolves.toEqual([expect.objectContaining({ status: EduGroupStatus.ACTIVE }), expect.objectContaining({ status: EduGroupStatus.ACTIVE })]);
  });
});

describe('условия для цепи', () => {
  it('номер допуска в цепи свой на каждую группу курса', () => {
    expect(chainAssignmentRef({ chain_ref: '7' }, { chain_ref: '3' })).toBe(3_000_007);
    expect(chainAssignmentRef({ chain_ref: '7' }, { chain_ref: '1001' })).toBe(1_001_000_007);
  });

  it('целевой членский взнос за месяц — месячный взнос без оплаты занятий по плановой ставке', () => {
    // 8 занятий по часу по 300 — 2400 из взноса 3000.
    expect(targetFeeMonth({ fee_month: '3000.0000 RUB', planned_hourly_rate: '300.0000 RUB', lesson_minutes: 60, lessons_per_month: 8 })).toBe('600.0000 RUB');
    // Занятие 45 минут: 225 за занятие, 1800 за месяц.
    expect(targetFeeMonth({ fee_month: '3000.0000 RUB', planned_hourly_rate: '300.0000 RUB', lesson_minutes: 45, lessons_per_month: 8 })).toBe('1200.0000 RUB');
  });
});
