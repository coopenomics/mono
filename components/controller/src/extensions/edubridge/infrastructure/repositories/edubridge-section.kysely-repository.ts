import { Inject, Injectable } from '@nestjs/common';
import { TableStore, oneOf } from '@coopenomics/extension-kit';
import { EDUBRIDGE_COURSE_STORE, EDUBRIDGE_LEVEL_STORE, EDUBRIDGE_SECTION_STORE } from '../database/edubridge-stores';
import { EduCourseStatus } from '../../domain/enums';
import { EdubridgeCourseRecord, EdubridgeLevelRecord, EdubridgeSectionRecord } from '../entities';

/** Справочник разделов и уровней каталога. */
@Injectable()
export class EdubridgeSectionKyselyRepository {
  constructor(
    @Inject(EDUBRIDGE_SECTION_STORE)
    private readonly sections: TableStore<EdubridgeSectionRecord>,
    @Inject(EDUBRIDGE_LEVEL_STORE)
    private readonly levels: TableStore<EdubridgeLevelRecord>,
    @Inject(EDUBRIDGE_COURSE_STORE)
    private readonly courses: TableStore<EdubridgeCourseRecord>
  ) {}

  /** Разделы с уровнями в порядке справочника. */
  async list(coopname: string): Promise<EdubridgeSectionRecord[]> {
    const rows = await this.sections.find({ coopname }, { order: { sort_order: 'ASC', title: 'ASC' } });
    const levels = rows.length ? await this.levels.find({ section_id: oneOf(rows.map((s) => s.id)) }) : [];
    for (const s of rows) {
      s.levels = levels
        .filter((l) => l.section_id === s.id)
        .sort((a, b) => a.sort_order - b.sort_order || a.title.localeCompare(b.title, 'ru', { numeric: true }));
    }
    return rows;
  }

  /** Пары «раздел — уровень», по которым есть опубликованные курсы. */
  async publishedPairs(coopname: string): Promise<Array<{ section_id: string; level_id: string | null }>> {
    return this.courses
      .sqlBuilder('c')
      .select('c.section_id', 'section_id')
      .addSelect('c.level_id', 'level_id')
      .where('c.coopname = :coopname', { coopname })
      .andWhere('c.status = :status', { status: EduCourseStatus.PUBLISHED })
      .andWhere('c.section_id IS NOT NULL')
      .groupBy('c.section_id')
      .addGroupBy('c.level_id')
      .getRawMany();
  }

  findSection(coopname: string, id: string): Promise<EdubridgeSectionRecord | null> {
    return this.sections.findOne({ coopname, id });
  }

  findSectionByTitle(coopname: string, title: string): Promise<EdubridgeSectionRecord | null> {
    return this.sections.sqlBuilder('s').where('s.coopname = :coopname', { coopname }).andWhere('lower(s.title) = lower(:title)', { title }).getOne();
  }

  findLevel(coopname: string, id: string): Promise<EdubridgeLevelRecord | null> {
    return this.levels.findOne({ coopname, id });
  }

  findLevelByTitle(sectionId: string, title: string): Promise<EdubridgeLevelRecord | null> {
    return this.levels.sqlBuilder('l').where('l.section_id = :sectionId', { sectionId }).andWhere('lower(l.title) = lower(:title)', { title }).getOne();
  }

  levelsOf(sectionId: string): Promise<EdubridgeLevelRecord[]> {
    return this.levels.find({ section_id: sectionId }, { order: { sort_order: 'ASC' } });
  }

  async nextSectionOrder(coopname: string): Promise<number> {
    const r = await this.sections.sqlBuilder('s').select('MAX(s.sort_order)', 'max').where('s.coopname = :coopname', { coopname }).getRawOne<{ max: number | null }>();
    return Number(r?.max ?? -1) + 1;
  }

  async nextLevelOrder(sectionId: string): Promise<number> {
    const r = await this.levels.sqlBuilder('l').select('MAX(l.sort_order)', 'max').where('l.section_id = :sectionId', { sectionId }).getRawOne<{ max: number | null }>();
    return Number(r?.max ?? -1) + 1;
  }

  saveSection(s: Partial<EdubridgeSectionRecord>): Promise<EdubridgeSectionRecord> {
    const { levels: _levels, ...row } = s;
    return this.sections.save(row);
  }

  saveLevel(l: Partial<EdubridgeLevelRecord>): Promise<EdubridgeLevelRecord> {
    const { section: _section, ...row } = l;
    return this.levels.save(row);
  }

  /** Курсы, ещё не перенесённые в справочник: раздел лежит строкой. */
  unmigratedCourses(coopname: string): Promise<EdubridgeCourseRecord[]> {
    return this.courses
      .sqlBuilder('c')
      .where('c.coopname = :coopname', { coopname })
      .andWhere('c.section_id IS NULL')
      .andWhere("coalesce(c.subject, '') <> ''")
      .getMany();
  }

  async linkCourse(id: string, sectionId: string, levelId: string | null): Promise<void> {
    await this.courses.update({ id }, { section_id: sectionId, level_id: levelId });
  }
}
