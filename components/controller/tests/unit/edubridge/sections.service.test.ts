/**
 * Справочник разделов и уровней каталога (7DD-23).
 *
 * Инварианты:
 *   - одно название — один раздел (уровень в разделе): ввод существующего
 *     названия, в другом регистре и с пробелами, возвращает прежнюю запись;
 *     переименование в занятое название — отказ;
 *   - новый раздел и уровень встают в конец порядка; порядок задаётся списком
 *     всех записей ровно по разу;
 *   - курсу нельзя выбрать архивное и уровень чужого раздела; архивное,
 *     уже стоящее у курса, остаётся;
 *   - перенос курсов со строками: пары становятся записями, курсы — ссылками,
 *     повторный перенос ничего не создаёт.
 */
import { BadRequestException, ConflictException } from '@nestjs/common';
import { EdubridgeSectionsService } from '~/extensions/edubridge/application/services/edubridge-sections.service';
import { EduCourseStatus } from '~/extensions/edubridge/domain/enums';

let seq = 0;
const nextId = () => `00000000-0000-4000-8000-${String(++seq).padStart(12, '0')}`;

function make() {
  const sections: any[] = [];
  const levels: any[] = [];
  const courses: any[] = [];
  const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
  const repo = {
    list: jest.fn(async (coop: string) =>
      sections
        .filter((s) => s.coopname === coop)
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((s) => ({ ...s, levels: levels.filter((l) => l.section_id === s.id).sort((a, b) => a.sort_order - b.sort_order) }))
    ),
    publishedPairs: jest.fn(async () =>
      courses.filter((c) => c.status === EduCourseStatus.PUBLISHED && c.section_id).map((c) => ({ section_id: c.section_id, level_id: c.level_id }))
    ),
    findSection: jest.fn(async (coop: string, id: string) => sections.find((s) => s.coopname === coop && s.id === id) ?? null),
    findSectionByTitle: jest.fn(async (coop: string, title: string) => sections.find((s) => s.coopname === coop && same(s.title, title)) ?? null),
    findLevel: jest.fn(async (coop: string, id: string) => levels.find((l) => l.coopname === coop && l.id === id) ?? null),
    findLevelByTitle: jest.fn(async (sectionId: string, title: string) => levels.find((l) => l.section_id === sectionId && same(l.title, title)) ?? null),
    levelsOf: jest.fn(async (sectionId: string) => levels.filter((l) => l.section_id === sectionId).sort((a, b) => a.sort_order - b.sort_order)),
    nextSectionOrder: jest.fn(async () => sections.length),
    nextLevelOrder: jest.fn(async (sectionId: string) => levels.filter((l) => l.section_id === sectionId).length),
    saveSection: jest.fn(async (s: any) => {
      const found = s.id && sections.find((x) => x.id === s.id);
      if (found) return Object.assign(found, s);
      const created = { id: nextId(), ...s };
      sections.push(created);
      return created;
    }),
    saveLevel: jest.fn(async (l: any) => {
      const found = l.id && levels.find((x) => x.id === l.id);
      if (found) return Object.assign(found, l);
      const created = { id: nextId(), ...l };
      levels.push(created);
      return created;
    }),
    unmigratedCourses: jest.fn(async () => courses.filter((c) => !c.section_id && c.legacy_subject)),
    linkCourse: jest.fn(async (id: string, section_id: string, level_id: string | null) => Object.assign(courses.find((c) => c.id === id), { section_id, level_id })),
  } as any;
  return { service: new EdubridgeSectionsService(repo), sections, levels, courses, repo };
}

describe('EdubridgeSectionsService — разделы и уровни', () => {
  it('новый раздел встаёт в конец; то же название в другом регистре — тот же раздел', async () => {
    const { service, sections } = make();
    const a = (await service.saveSection('voskhod', { title: 'Математика' })).section;
    const b = (await service.saveSection('voskhod', { title: 'Духовные практики' })).section;
    const again = (await service.saveSection('voskhod', { title: '  математика ' })).section;

    expect([a.sort_order, b.sort_order]).toEqual([0, 1]);
    expect(again.id).toBe(a.id);
    expect(sections).toHaveLength(2);
  });

  it('переименование в занятое название — отказ; пустое — отказ', async () => {
    const { service } = make();
    await service.saveSection('voskhod', { title: 'Математика' });
    const b = (await service.saveSection('voskhod', { title: 'Физика' })).section;

    await expect(service.saveSection('voskhod', { id: b.id, title: 'математика' })).rejects.toBeInstanceOf(ConflictException);
    await expect(service.saveSection('voskhod', { title: '   ' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('уровень — внутри своего раздела: то же название в другом разделе — другой уровень', async () => {
    const { service, levels } = make();
    const math = (await service.saveSection('voskhod', { title: 'Математика' })).section;
    const phys = (await service.saveSection('voskhod', { title: 'Физика' })).section;
    const m7 = await service.saveLevel('voskhod', { section_id: math.id, title: '7 класс' });
    const p7 = await service.saveLevel('voskhod', { section_id: phys.id, title: '7 класс' });
    const m7again = await service.saveLevel('voskhod', { section_id: math.id, title: '7 КЛАСС' });

    expect(m7.id).not.toBe(p7.id);
    expect(m7again.id).toBe(m7.id);
    expect(levels).toHaveLength(2);
  });

  it('порядок уровней — по списку; список не всех уровней — отказ', async () => {
    const { service } = make();
    const s = (await service.saveSection('voskhod', { title: 'Медитация' })).section;
    const l1 = await service.saveLevel('voskhod', { section_id: s.id, title: 'Ступень 1' });
    const l2 = await service.saveLevel('voskhod', { section_id: s.id, title: 'Ступень 2' });

    const [after] = await service.reorder('voskhod', { section_id: s.id, ids: [l2.id, l1.id] });
    expect(after!.levels.map((l) => l.title)).toEqual(['Ступень 2', 'Ступень 1']);
    await expect(service.reorder('voskhod', { section_id: s.id, ids: [l1.id] })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('список: архивное скрыто, пока не попросили; для каталога — только то, где есть опубликованные курсы', async () => {
    const { service, courses } = make();
    const math = (await service.saveSection('voskhod', { title: 'Математика' })).section;
    const old = (await service.saveSection('voskhod', { title: 'Устаревшее' })).section;
    const empty = (await service.saveSection('voskhod', { title: 'Пустой' })).section;
    const m7 = await service.saveLevel('voskhod', { section_id: math.id, title: '7 класс' });
    await service.saveLevel('voskhod', { section_id: math.id, title: '8 класс' });
    await service.archiveSection('voskhod', old.id, true);
    courses.push({ id: 'c1', status: EduCourseStatus.PUBLISHED, section_id: math.id, level_id: m7.id });

    expect((await service.list('voskhod')).map((x) => x.section.title)).toEqual(['Математика', 'Пустой']);
    expect((await service.list('voskhod', { include_archived: true })).map((x) => x.section.title)).toEqual(['Математика', 'Устаревшее', 'Пустой']);
    const catalog = await service.list('voskhod', { only_with_courses: true });
    expect(catalog.map((x) => [x.section.title, x.levels.map((l) => l.title)])).toEqual([['Математика', ['7 класс']]]);
    expect(empty.id).toBeTruthy();
  });

  it('курсу: уровень чужого раздела и архивное — отказ; архивное, уже стоящее у курса, остаётся', async () => {
    const { service } = make();
    const math = (await service.saveSection('voskhod', { title: 'Математика' })).section;
    const phys = (await service.saveSection('voskhod', { title: 'Физика' })).section;
    const p7 = await service.saveLevel('voskhod', { section_id: phys.id, title: '7 класс' });
    await service.archiveSection('voskhod', math.id, true);

    await expect(service.assertForCourse('voskhod', phys.id, p7.id)).resolves.toBeUndefined();
    await expect(service.assertForCourse('voskhod', math.id, p7.id, { section_id: math.id, level_id: null })).rejects.toThrow('не принадлежит разделу');
    await expect(service.assertForCourse('voskhod', math.id, null)).rejects.toThrow('в архиве');
    await expect(service.assertForCourse('voskhod', math.id, null, { section_id: math.id, level_id: null })).resolves.toBeUndefined();
  });

  it('перенос курсов со строками: пары — в справочник, курсы — ссылками; повторно ничего не создаётся', async () => {
    const { service, sections, levels, courses } = make();
    courses.push(
      { id: 'c1', legacy_subject: 'Тест', legacy_grade: 'Начинающий', section_id: null, level_id: null },
      { id: 'c2', legacy_subject: 'тест ', legacy_grade: '', section_id: null, level_id: null }
    );

    await expect(service.migrateLegacyCourses('voskhod')).resolves.toBe(2);
    expect(sections.map((s) => s.title)).toEqual(['Тест']);
    expect(levels.map((l) => l.title)).toEqual(['Начинающий']);
    expect(courses[0]).toEqual(expect.objectContaining({ section_id: sections[0].id, level_id: levels[0].id }));
    expect(courses[1]).toEqual(expect.objectContaining({ section_id: sections[0].id, level_id: null }));
    await expect(service.migrateLegacyCourses('voskhod')).resolves.toBe(0);
  });
});
