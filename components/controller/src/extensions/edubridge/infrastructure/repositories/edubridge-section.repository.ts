import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EduCourseStatus } from '../../domain/enums';
import { EdubridgeCourseEntity, EdubridgeLevelEntity, EdubridgeSectionEntity } from '../entities';

/** Справочник разделов и уровней каталога. */
@Injectable()
export class EdubridgeSectionRepository {
  constructor(
    @InjectRepository(EdubridgeSectionEntity) private readonly sections: Repository<EdubridgeSectionEntity>,
    @InjectRepository(EdubridgeLevelEntity) private readonly levels: Repository<EdubridgeLevelEntity>,
    @InjectRepository(EdubridgeCourseEntity) private readonly courses: Repository<EdubridgeCourseEntity>
  ) {}

  /** Разделы с уровнями в порядке справочника. */
  async list(coopname: string): Promise<EdubridgeSectionEntity[]> {
    const rows = await this.sections.find({
      where: { coopname },
      relations: { levels: true },
      order: { sort_order: 'ASC', title: 'ASC' },
    });
    for (const s of rows) s.levels = [...(s.levels ?? [])].sort((a, b) => a.sort_order - b.sort_order || a.title.localeCompare(b.title, 'ru', { numeric: true }));
    return rows;
  }

  /** Пары «раздел — уровень», по которым есть опубликованные курсы. */
  async publishedPairs(coopname: string): Promise<Array<{ section_id: string; level_id: string | null }>> {
    return this.courses
      .createQueryBuilder('c')
      .select('c.section_id', 'section_id')
      .addSelect('c.level_id', 'level_id')
      .where('c.coopname = :coopname', { coopname })
      .andWhere('c.status = :status', { status: EduCourseStatus.PUBLISHED })
      .andWhere('c.section_id IS NOT NULL')
      .groupBy('c.section_id')
      .addGroupBy('c.level_id')
      .getRawMany();
  }

  findSection(coopname: string, id: string): Promise<EdubridgeSectionEntity | null> {
    return this.sections.findOne({ where: { coopname, id } });
  }

  findSectionByTitle(coopname: string, title: string): Promise<EdubridgeSectionEntity | null> {
    return this.sections.createQueryBuilder('s').where('s.coopname = :coopname', { coopname }).andWhere('lower(s.title) = lower(:title)', { title }).getOne();
  }

  findLevel(coopname: string, id: string): Promise<EdubridgeLevelEntity | null> {
    return this.levels.findOne({ where: { coopname, id } });
  }

  findLevelByTitle(sectionId: string, title: string): Promise<EdubridgeLevelEntity | null> {
    return this.levels.createQueryBuilder('l').where('l.section_id = :sectionId', { sectionId }).andWhere('lower(l.title) = lower(:title)', { title }).getOne();
  }

  levelsOf(sectionId: string): Promise<EdubridgeLevelEntity[]> {
    return this.levels.find({ where: { section_id: sectionId }, order: { sort_order: 'ASC' } });
  }

  async nextSectionOrder(coopname: string): Promise<number> {
    const r = await this.sections.createQueryBuilder('s').select('MAX(s.sort_order)', 'max').where('s.coopname = :coopname', { coopname }).getRawOne<{ max: number | null }>();
    return Number(r?.max ?? -1) + 1;
  }

  async nextLevelOrder(sectionId: string): Promise<number> {
    const r = await this.levels.createQueryBuilder('l').select('MAX(l.sort_order)', 'max').where('l.section_id = :sectionId', { sectionId }).getRawOne<{ max: number | null }>();
    return Number(r?.max ?? -1) + 1;
  }

  saveSection(s: Partial<EdubridgeSectionEntity>): Promise<EdubridgeSectionEntity> {
    return this.sections.save(this.sections.create(s));
  }

  saveLevel(l: Partial<EdubridgeLevelEntity>): Promise<EdubridgeLevelEntity> {
    return this.levels.save(this.levels.create(l));
  }

  /** Курсы, ещё не перенесённые в справочник: раздел лежит строкой. */
  unmigratedCourses(coopname: string): Promise<EdubridgeCourseEntity[]> {
    return this.courses
      .createQueryBuilder('c')
      .where('c.coopname = :coopname', { coopname })
      .andWhere('c.section_id IS NULL')
      .andWhere("coalesce(c.subject, '') <> ''")
      .getMany();
  }

  async linkCourse(id: string, sectionId: string, levelId: string | null): Promise<void> {
    await this.courses.update({ id }, { section_id: sectionId, level_id: levelId });
  }
}
