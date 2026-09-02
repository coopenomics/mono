/** Конструктор курса: носитель по направлению, идентификатор площадки, преподаватели только с договором. */
import { EdubridgeCourseService } from '~/extensions/edubridge/application/services/edubridge-course.service';
import { EduAccessCarrier, EduCourseDirection, EduCourseStatus } from '~/extensions/edubridge/domain/enums';

const COURSE_UUID = '0cd16d12-6ade-40f2-8830-b0673dde8b9e';
const GROUP_UUID = '426fa814-9a36-4e9a-9fb0-ca5672afe667';

function make(contracts: string[] = ['teach']) {
  const saved: any[] = [];
  const courses = {
    create: jest.fn((d: any) => ({ ...d })),
    save: jest.fn(async (c: any) => { saved.push(c); return c; }),
    findById: jest.fn(async (_coop: string, id: string) => ({ id, external_ref: 'old', status: EduCourseStatus.DRAFT })),
  } as any;
  const teachers = {
    listContracts: jest.fn(async () => contracts.map((t, i) => ({ teacher_username: t, contract_number: `УХД-${i + 1}`, signed_at: new Date('2026-02-01') }))),
  } as any;
  const skillspace = {
    listCourses: jest.fn(async () => [{ id: COURSE_UUID, name: 'Тестовый курс [coop]', slug: 'testovyj-kurs-coop' }, { id: 'aaaaaaaa-0000-4000-8000-000000000001', name: 'Другой' }]),
    listGroups: jest.fn(async () => [{ id: GROUP_UUID, courseId: COURSE_UUID, name: 'Группа А', studentsCount: 1 }]),
  } as any;
  return { service: new EdubridgeCourseService(courses, teachers, skillspace), courses, teachers, saved };
}

const base = {
  title: 'Алгебра',
  subject: 'Математика',
  grade: '7 класс',
  fee_month: '1000.0000 RUB',
  fee_year: '10000.0000 RUB',
  direction: EduCourseDirection.ONLINE_PLATFORM,
  carrier: EduAccessCarrier.SKILLSPACE,
  external_ref: COURSE_UUID,
} as any;

describe('EdubridgeCourseService — конструктор курса', () => {
  it('онлайн-платформа + Skillspace + идентификатор + преподаватель с договором: курс создаётся черновиком', async () => {
    const { service, saved } = make();
    const course = await service.create('voskhod', { ...base, teacher_usernames: ['teach'] });
    expect(course.status).toBe(EduCourseStatus.DRAFT);
    expect(course.teacher_usernames).toEqual(['teach']);
    expect(saved).toHaveLength(1);
  });

  it.each([
    [EduCourseDirection.ONLINE_PLATFORM, EduAccessCarrier.TELEGRAM],
    [EduCourseDirection.ONLINE_PLATFORM, EduAccessCarrier.ONSITE],
    [EduCourseDirection.CLOSED_COMMUNITY, EduAccessCarrier.SKILLSPACE],
    [EduCourseDirection.ONSITE, EduAccessCarrier.GETCOURSE],
  ])('носитель не по направлению (%s + %s) — отказ', async (direction, carrier) => {
    const { service } = make();
    await expect(service.create('voskhod', { ...base, direction, carrier })).rejects.toThrow(/недопустим для направления/);
  });

  it('площадка без идентификатора курса — отказ', async () => {
    const { service } = make();
    await expect(service.create('voskhod', { ...base, external_ref: '  ' })).rejects.toThrow(/идентификатор курса/);
  });

  it('очное обучение: идентификатор площадки не нужен и не сохраняется', async () => {
    const { service } = make();
    const course = await service.create('voskhod', {
      ...base,
      direction: EduCourseDirection.ONSITE,
      carrier: EduAccessCarrier.ONSITE,
      external_ref: 'что-то лишнее',
    });
    expect(course.external_ref).toBe('');
  });

  it.each(['131851', '77dc07a8-d949-40c1-ae20-b8c9314df709x', `${COURSE_UUID}:12`])('Skillspace: не UUID курса/группы (%s) — отказ с подсказкой про реестр школы', async (ref) => {
    const { service } = make();
    await expect(service.create('voskhod', { ...base, external_ref: ref })).rejects.toThrow(/UUID курса из реестра школы/);
  });

  it('platformCourses: курсы школы с их группами; для других носителей — пусто', async () => {
    const { service } = make();
    const list = await service.platformCourses(EduAccessCarrier.SKILLSPACE);
    expect(list).toEqual([
      { id: COURSE_UUID, name: 'Тестовый курс [coop]', groups: [{ id: GROUP_UUID, name: 'Группа А' }] },
      { id: 'aaaaaaaa-0000-4000-8000-000000000001', name: 'Другой', groups: [] },
    ]);
    expect(await service.platformCourses(EduAccessCarrier.GETCOURSE)).toEqual([]);
  });

  it('преподаватель без договора УХД — отказ с именем', async () => {
    const { service } = make(['teach']);
    await expect(service.create('voskhod', { ...base, teacher_usernames: ['teach', 'stranger'] })).rejects.toThrow(/stranger/);
  });

  it('несколько преподавателей с договорами — сохраняются все', async () => {
    const { service } = make(['a', 'b']);
    const course = await service.create('voskhod', { ...base, teacher_usernames: ['a', 'b'] });
    expect(course.teacher_usernames).toEqual(['a', 'b']);
  });

  it('teacherOptions отдаёт пайщиков с договором и номером договора', async () => {
    const { service } = make(['a', 'b']);
    const options = await service.teacherOptions('voskhod');
    expect(options.map((o) => o.username)).toEqual(['a', 'b']);
    expect(options[0]!.contract_number).toBe('УХД-1');
  });

  it('обновление с новым идентификатором площадки сбрасывает сверку', async () => {
    const { service } = make();
    const course = await service.update('voskhod', { ...base, id: 'C1', external_ref: `${COURSE_UUID}:${GROUP_UUID}` });
    expect(course.external_ref).toBe(`${COURSE_UUID}:${GROUP_UUID}`);
    expect(course.external_title_seen).toBeNull();
    expect(course.external_checked_at).toBeNull();
  });
});
