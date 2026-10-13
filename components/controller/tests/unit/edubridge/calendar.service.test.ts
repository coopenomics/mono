import { EdubridgeCalendarService } from '~/extensions/edubridge/application/services/edubridge-calendar.service';
import { EduLessonOrigin, EduLessonStatus } from '~/extensions/edubridge/domain/enums';
import { formatSlots, normalizeSlots, programOf, slotOccurrences, zonedParts } from '~/extensions/edubridge/domain/lib/schedule';
import { lessonEndsAt, reportUntil } from '~/extensions/edubridge/domain/lib/lesson-dates';

jest.mock('@coopenomics/extension-kit', () => ({
  ...jest.requireActual('@coopenomics/extension-kit'),
  platformSettings: () => ({ coopname: 'voskhod', timezone: 'Europe/Moscow', blockchain: { rootGovernSymbol: 'RUB', rootGovernPrecision: 4 } }),
}));

const logger = { setContext: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() } as any;
const TUE_THU = [
  { weekday: 2, time: '17:00', minutes: 60, assignment_id: 'A1' },
  { weekday: 4, time: '17:00', minutes: 60, assignment_id: 'A1' },
];

/** Группа курса: 12 занятий по 60 минут, 8 в месяц, начало в среду 14.10.2026. */
function groupOf(over: Record<string, unknown> = {}) {
  return {
    id: 'G1',
    coopname: 'voskhod',
    course_id: 'C1',
    title: 'Группа 1',
    status: 'active',
    starts_at: '2026-10-14',
    starts_at_time: null,
    lessons_per_month: 8,
    lessons_total: 12,
    lesson_minutes: 60,
    program_months: 2,
    minutes_per_month: 360,
    minutes_total: 720,
    schedule_slots: TUE_THU,
    report_days: 7,
    ...over,
  } as any;
}

function make(opts: { group?: any; lessons?: any[]; assignments?: Record<string, any> } = {}) {
  const group = opts.group ?? groupOf();
  const store = new Map<string, any>((opts.lessons ?? []).map((l) => [l.id, l]));
  let seq = 100;
  const lessons = {
    findByGroup: jest.fn(async () => [...store.values()]),
    findById: jest.fn(async (_c: string, id: string) => store.get(id) ?? null),
    findInRange: jest.fn(async () => [...store.values()]),
    deleteMany: jest.fn(async (ids: string[]) => { for (const id of ids) store.delete(id); return ids.length; }),
    create: jest.fn((d: any) => ({ id: `L${(seq += 1)}`, ...d })),
    save: jest.fn(async (l: any) => { store.set(l.id, l); return l; }),
  } as any;
  const groups = { findById: jest.fn(async () => group), save: jest.fn(async (g: any) => g) } as any;
  const courses = { findById: jest.fn(async () => ({ id: 'C1' })) } as any;
  const assignments: Record<string, any> = {
    A1: { id: 'A1', course_id: 'C1', teacher_username: 'teach', status: 'active' },
    A2: { id: 'A2', course_id: 'C1', teacher_username: 'other', status: 'active' },
    AX: { id: 'AX', course_id: 'C9', teacher_username: 'alien', status: 'active' },
    ...opts.assignments,
  };
  const teachers = { findAssignment: jest.fn(async (_c: string, id: string) => assignments[id] ?? null) } as any;
  const service = new EdubridgeCalendarService(lessons, groups, courses, teachers, logger);
  const live = () => [...store.values()].filter((l) => l.status !== EduLessonStatus.CANCELLED).sort((a, b) => a.held_at - b.held_at);
  return { service, group, store, lessons, live };
}

const moscow = (iso: string) => new Date(iso).toISOString();

describe('Окна расписания и моменты занятий', () => {
  it('окна проверяются и строятся в строку «Вт, Чт 17:00–18:00»; время — местное время кооператива', () => {
    const slots = normalizeSlots([{ weekday: 4, time: '17:00', minutes: 60, assignment_id: null }, { weekday: 2, time: '17:00', minutes: 60, assignment_id: 'A1' }]);
    expect(slots.map((s) => s.weekday)).toEqual([2, 4]);
    expect(formatSlots(slots)).toBe('Вт, Чт 17:00–18:00');
    expect(formatSlots([...slots, { weekday: 6, time: '10:30', minutes: 90, assignment_id: null }])).toBe('Вт, Чт 17:00–18:00; Сб 10:30–12:00');
    expect(() => normalizeSlots([{ weekday: 8, time: '17:00', minutes: 60 }])).toThrow(expect.objectContaining({ code: 'EDUBRIDGE_SCHEDULE_WEEKDAY_INVALID' }));
    expect(() => normalizeSlots([{ weekday: 1, time: '25:00', minutes: 60 }])).toThrow(expect.objectContaining({ code: 'EDUBRIDGE_SCHEDULE_TIME_INVALID' }));
    expect(() => normalizeSlots([{ weekday: 1, time: '17:00', minutes: 1 }])).toThrow(expect.objectContaining({ code: 'EDUBRIDGE_SCHEDULE_MINUTES_INVALID' }));
  });

  it('от среды 14.10.2026 занятия по вторникам и четвергам идут с четверга 15.10, 17:00 по Москве', () => {
    const out = slotOccurrences(TUE_THU, new Date('2026-10-14T00:00:00Z'), 3, 'Europe/Moscow');
    expect(out.map((o) => o.at.toISOString())).toEqual([moscow('2026-10-15T14:00:00Z'), moscow('2026-10-20T14:00:00Z'), moscow('2026-10-22T14:00:00Z')]);
    expect(zonedParts(out[0].at, 'Europe/Moscow')).toMatchObject({ weekday: 4, hour: 17, minute: 0 });
  });

  it('числа программы из окон: минуты недели на 52/12, занятия — для показа, длительность — по первому окну', () => {
    expect(programOf(TUE_THU, 8)).toEqual({ minutes_per_month: 520, minutes_total: 4160, lessons_per_month: 9, lessons_total: 72, lesson_minutes: 60 });
    expect(programOf([{ minutes: 90 }], 0)).toEqual({ minutes_per_month: 390, minutes_total: 0, lessons_per_month: 4, lessons_total: 0, lesson_minutes: 90 });
    expect(programOf([], 3).minutes_per_month).toBe(0);
  });

  it('конец занятия и срок на отчёт: настоящие сутки в работе, сжатые — на стенде', () => {
    const lesson = { held_at: new Date('2026-10-15T14:00:00Z'), duration_minutes: 60 };
    const previous = { mode: process.env.NODE_ENV, day: process.env.EDUBRIDGE_GUARANTEE_DAY_SECONDS };
    process.env.NODE_ENV = 'production';
    expect(lessonEndsAt(lesson).toISOString()).toBe('2026-10-15T15:00:00.000Z');
    expect(reportUntil(lesson, 7).toISOString()).toBe('2026-10-22T15:00:00.000Z');
    process.env.NODE_ENV = 'development';
    process.env.EDUBRIDGE_GUARANTEE_DAY_SECONDS = '60';
    // Сутки — минута: часовое занятие длится 2,5 секунды, семь дней на отчёт — семь минут.
    expect(lessonEndsAt(lesson).getTime() - lesson.held_at.getTime()).toBe(2500);
    expect(reportUntil(lesson, 7).getTime() - lesson.held_at.getTime()).toBe(2500 + 7 * 60_000);
    process.env.NODE_ENV = previous.mode;
    if (previous.day === undefined) delete process.env.EDUBRIDGE_GUARANTEE_DAY_SECONDS;
    else process.env.EDUBRIDGE_GUARANTEE_DAY_SECONDS = previous.day;
  });
});

describe('EdubridgeCalendarService — календарь группы', () => {
  const previousMode = process.env.NODE_ENV;
  beforeEach(() => { process.env.NODE_ENV = 'production'; });
  afterEach(() => { process.env.NODE_ENV = previousMode; });

  it('календарь строится на всю программу: 720 минут — 12 часовых занятий по вторникам и четвергам, номера по порядку дат, преподаватель из окна', async () => {
    const { service, group, live } = make();
    const built = await service.rebuild('voskhod', group);
    expect(built).toHaveLength(12);
    const rows = live();
    expect(rows.map((l) => l.lesson_number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(rows[0]).toMatchObject({ status: EduLessonStatus.PLANNED, origin: EduLessonOrigin.SCHEDULE, teacher_username: 'teach', assignment_id: 'A1', duration_minutes: 60 });
    expect(rows[0].held_at.toISOString()).toBe('2026-10-15T14:00:00.000Z');
    expect(rows[11].held_at.toISOString()).toBe('2026-11-24T14:00:00.000Z');
  });

  it('перестройка: проведённые и назначенные отдельно занятия остаются, по расписанию строится остаток программы', async () => {
    const held = { id: 'H1', group_id: 'G1', lesson_number: 1, status: EduLessonStatus.HELD, origin: EduLessonOrigin.SCHEDULE, held_at: new Date('2026-10-15T14:00:00Z'), duration_minutes: 60 };
    const extra = { id: 'X1', group_id: 'G1', lesson_number: 2, status: EduLessonStatus.PLANNED, origin: EduLessonOrigin.EXTRA, held_at: new Date('2026-10-17T10:00:00Z'), duration_minutes: 120 };
    const stale = { id: 'S1', group_id: 'G1', lesson_number: 3, status: EduLessonStatus.PLANNED, origin: EduLessonOrigin.SCHEDULE, held_at: new Date('2026-10-20T14:00:00Z'), duration_minutes: 60 };
    const { service, group, store, live } = make({ lessons: [held, extra, stale] });
    await service.rebuild('voskhod', group);
    expect(store.has('H1')).toBe(true);
    expect(store.has('X1')).toBe(true);
    expect(store.has('S1')).toBe(false);
    // Проведённое — 60 минут, дополнительное — 120: из 720 минут по расписанию остаётся девять часовых.
    const scheduled = live().filter((l) => l.origin === EduLessonOrigin.SCHEDULE && l.status === EduLessonStatus.PLANNED);
    expect(scheduled).toHaveLength(9);
    expect(scheduled.map((l) => l.lesson_number)).toEqual([3, 4, 5, 6, 7, 8, 9, 10, 11]);
  });

  it('дополнительное занятие при заполненной программе снимает последние по расписанию; двухчасовое — два', async () => {
    const { service, group, live, lessons } = make();
    await service.rebuild('voskhod', group);
    const lastBefore = live()[11];
    const extra = await service.plan('voskhod', { group_id: 'G1', held_at: '2026-10-24T10:00:00Z', minutes: 120, assignment_id: 'A2', topic: 'Контрольная' });
    expect(extra).toMatchObject({ origin: EduLessonOrigin.EXTRA, status: EduLessonStatus.PLANNED, teacher_username: 'other', duration_minutes: 120 });
    // Сняты два последних занятия по расписанию, свободный номер — освободившийся 11.
    expect(lessons.deleteMany).toHaveBeenLastCalledWith(expect.arrayContaining([lastBefore.id]));
    expect(live()).toHaveLength(11);
    expect(extra.lesson_number).toBe(11);
    const minutes = live().reduce((sum, l) => sum + l.duration_minutes, 0);
    expect(minutes).toBe(720);
  });

  it('программа заполнена проведёнными и назначенными занятиями: дополнительное и удлинение отклоняются; чужой допуск в окне — отказ', async () => {
    const full = Array.from({ length: 12 }, (_, i) => ({ id: `F${i + 1}`, group_id: 'G1', lesson_number: i + 1, status: i < 6 ? EduLessonStatus.HELD : EduLessonStatus.PLANNED, origin: EduLessonOrigin.EXTRA, held_at: new Date(Date.UTC(2026, 9, 15 + i)), duration_minutes: 60 }));
    const { service } = make({ lessons: full });
    await expect(service.plan('voskhod', { group_id: 'G1', held_at: '2026-12-01T10:00:00Z' })).rejects.toMatchObject({ code: 'EDUBRIDGE_PROGRAM_FULL' });
    await expect(service.move('voskhod', { lesson_id: 'F12', minutes: 120 })).rejects.toMatchObject({ code: 'EDUBRIDGE_PROGRAM_FULL' });
    await expect(service.move('voskhod', { lesson_id: 'F1', held_at: '2026-12-01T10:00:00Z' })).rejects.toMatchObject({ code: 'EDUBRIDGE_LESSON_NOT_PLANNED' });
    await expect(service.cancel('voskhod', 'F1')).rejects.toMatchObject({ code: 'EDUBRIDGE_LESSON_NOT_PLANNED' });
    await expect(service.setSchedule('voskhod', { group_id: 'G1', slots: [{ weekday: 1, time: '10:00', minutes: 60, assignment_id: 'AX' }] })).rejects.toMatchObject({ code: 'EDUBRIDGE_SCHEDULE_TEACHER_NOT_ASSIGNED' });
  });

  it('отмена освобождает номер: следующее дополнительное занятие получает его; перенос меняет дату и преподавателя', async () => {
    const { service, group, live, store } = make();
    await service.rebuild('voskhod', group);
    const fifth = live()[4];
    const cancelled = await service.cancel('voskhod', fifth.id);
    expect(cancelled.status).toBe(EduLessonStatus.CANCELLED);
    expect(store.get(fifth.id).lesson_number).toBe(5);
    const replacement = await service.plan('voskhod', { group_id: 'G1', held_at: '2026-10-31T10:00:00Z', assignment_id: 'A1' });
    expect(replacement.lesson_number).toBe(5);
    const moved = await service.move('voskhod', { lesson_id: replacement.id, held_at: '2026-11-01T10:00:00Z', assignment_id: 'A2', topic: 'Перенос' });
    expect(moved).toMatchObject({ lesson_number: 5, teacher_username: 'other', topic: 'Перенос', origin: EduLessonOrigin.EXTRA });
    expect(moved.held_at.toISOString()).toBe('2026-11-01T10:00:00.000Z');
  });

  it('окна расписания группы: сохраняются, срок на отчёт проверяется, календарь перестраивается', async () => {
    const { service, group, live } = make({ group: groupOf({ schedule_slots: [] }) });
    await expect(service.setSchedule('voskhod', { group_id: 'G1', slots: TUE_THU, report_days: 400 })).rejects.toMatchObject({ code: 'EDUBRIDGE_REPORT_DAYS_INVALID' });
    const saved = await service.setSchedule('voskhod', { group_id: 'G1', slots: [TUE_THU[1], TUE_THU[0]], report_days: 3 });
    expect(saved.schedule_slots.map((s: any) => s.weekday)).toEqual([2, 4]);
    expect(saved.report_days).toBe(3);
    expect(live()).toHaveLength(12);
    expect(group.schedule_slots).toHaveLength(2);
    // Без окон занятия по расписанию снимаются.
    await service.setSchedule('voskhod', { group_id: 'G1', slots: [] });
    expect(live()).toHaveLength(0);
  });

  it('на стенде со сжатым временем занятия раскладываются равными шагами по сжатому месяцу', async () => {
    const previous = { day: process.env.EDUBRIDGE_GUARANTEE_DAY_SECONDS, month: process.env.EDUBRIDGE_MONTH_SECONDS };
    process.env.NODE_ENV = 'development';
    process.env.EDUBRIDGE_GUARANTEE_DAY_SECONDS = '60';
    process.env.EDUBRIDGE_MONTH_SECONDS = '600';
    const { service, group, live } = make({ group: groupOf({ starts_at_time: new Date('2026-10-14T10:00:00Z') }) });
    await service.rebuild('voskhod', group);
    const rows = live();
    expect(rows).toHaveLength(12);
    // Восемь занятий в месяц из десяти минут — шаг 75 секунд.
    expect(rows[1].held_at.getTime() - rows[0].held_at.getTime()).toBe(75_000);
    expect(rows[0].held_at.toISOString()).toBe('2026-10-14T10:00:00.000Z');
    if (previous.day === undefined) delete process.env.EDUBRIDGE_GUARANTEE_DAY_SECONDS;
    else process.env.EDUBRIDGE_GUARANTEE_DAY_SECONDS = previous.day;
    if (previous.month === undefined) delete process.env.EDUBRIDGE_MONTH_SECONDS;
    else process.env.EDUBRIDGE_MONTH_SECONDS = previous.month;
  });
});
