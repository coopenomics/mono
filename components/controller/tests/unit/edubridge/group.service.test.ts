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
  const courses = { findById: jest.fn(async () => opts.course ?? course), listAll: jest.fn(async () => [opts.course ?? course]) } as any;
  const enrollments = { findByGroup: jest.fn(async () => opts.enrollments ?? []) } as any;
  const lessons = { findByGroup: jest.fn(async () => opts.lessons ?? []) } as any;
  const chainTerms = { pushCourse: jest.fn(async () => undefined), tryPushCourse: jest.fn(async () => true) } as any;
  return { service: new EdubridgeGroupService(groups, courses, enrollments, lessons, chainTerms, logger), store, chainTerms, groups };
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

  it('группа с действующими подписками не завершается', async () => {
    const busy = make({ groups: [group()], enrollments: [{ status: EduEnrollmentStatus.ACTIVE }] });
    await expect(busy.service.close('voskhod', 'G1')).rejects.toMatchObject({ code: 'EDUBRIDGE_GROUP_HAS_SUBSCRIPTIONS' });
    const free = make({ groups: [group()], enrollments: [{ status: EduEnrollmentStatus.EXPIRED }] });
    await expect(free.service.close('voskhod', 'G1')).resolves.toMatchObject({ status: EduGroupStatus.CLOSED, enrollment_open: false });
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
