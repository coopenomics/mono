import { Injectable } from '@nestjs/common';
import type { EdubridgeLevelEntity, EdubridgeSectionEntity } from '../../infrastructure/entities';
import { EdubridgeSectionRepository } from '../../infrastructure/repositories/edubridge-section.repository';
import type { EduReorderInputDTO, EduSaveLevelInputDTO, EduSaveSectionInputDTO, EduSectionsFilterInputDTO } from '../dto/edu-section.dto';
import { t } from '../../i18n';
import { DomainError } from '@coopenomics/extension-kit';

export interface SectionWithLevels {
  section: EdubridgeSectionEntity;
  levels: EdubridgeLevelEntity[];
}

/**
 * Справочник разделов и уровней каталога (7DD-23). Раздел — область знаний,
 * уровень — ступень внутри раздела; порядок уровней — их последовательность.
 * Курсы ссылаются на записи справочника, поэтому переименование и порядок
 * меняются один раз для всех курсов. Совпадение названий сравнивается без
 * учёта регистра и пробелов по краям: «математика» и «Математика » — один раздел.
 */
@Injectable()
export class EdubridgeSectionsService {
  constructor(private readonly repo: EdubridgeSectionRepository) {}

  async list(coopname: string, filter: EduSectionsFilterInputDTO = {}): Promise<SectionWithLevels[]> {
    const sections = await this.repo.list(coopname);
    const pairs = filter.only_with_courses ? await this.repo.publishedPairs(coopname) : null;
    return sections
      .filter((s) => filter.include_archived || !s.archived)
      .filter((s) => !pairs || pairs.some((p) => p.section_id === s.id))
      .map((section) => ({
        section,
        levels: (section.levels ?? [])
          .filter((l) => filter.include_archived || !l.archived)
          .filter((l) => !pairs || pairs.some((p) => p.level_id === l.id)),
      }));
  }

  async saveSection(coopname: string, input: EduSaveSectionInputDTO): Promise<SectionWithLevels> {
    const title = clean(input.title);
    if (!title) throw DomainError.badRequest('EDUBRIDGE_SECTION_TITLE_EMPTY');
    const same = await this.repo.findSectionByTitle(coopname, title);
    if (same && same.id !== input.id) {
      if (!input.id) return this.withLevels(same); // ввод существующего названия — тот же раздел
      throw DomainError.conflict('EDUBRIDGE_SECTION_ALREADY_EXISTS', { title: same.title });
    }
    if (input.id) {
      const section = await this.repo.findSection(coopname, input.id);
      if (!section) throw DomainError.notFound('EDUBRIDGE_SECTION_NOT_FOUND');
      section.title = title;
      return this.withLevels(await this.repo.saveSection(section));
    }
    const created = await this.repo.saveSection({ coopname, title, sort_order: await this.repo.nextSectionOrder(coopname), archived: false });
    return { section: created, levels: [] };
  }

  async saveLevel(coopname: string, input: EduSaveLevelInputDTO): Promise<EdubridgeLevelEntity> {
    const title = clean(input.title);
    if (!title) throw DomainError.badRequest('EDUBRIDGE_LEVEL_TITLE_EMPTY');
    const section = await this.repo.findSection(coopname, input.section_id);
    if (!section) throw DomainError.notFound('EDUBRIDGE_SECTION_NOT_FOUND');
    const same = await this.repo.findLevelByTitle(section.id, title);
    if (same && same.id !== input.id) {
      if (!input.id) return same;
      throw DomainError.conflict('EDUBRIDGE_LEVEL_ALREADY_EXISTS', { title: same.title, sectionTitle: section.title });
    }
    if (input.id) {
      const level = await this.repo.findLevel(coopname, input.id);
      if (!level || level.section_id !== section.id) throw DomainError.notFound('EDUBRIDGE_LEVEL_NOT_FOUND');
      level.title = title;
      return this.repo.saveLevel(level);
    }
    return this.repo.saveLevel({ coopname, section_id: section.id, title, sort_order: await this.repo.nextLevelOrder(section.id), archived: false });
  }

  /** Порядок разделов (section_id пуст) либо уровней раздела — по списку идентификаторов. */
  async reorder(coopname: string, input: EduReorderInputDTO): Promise<SectionWithLevels[]> {
    if (input.section_id) {
      const levels = await this.repo.levelsOf(input.section_id);
      assertSameSet(levels.map((l) => l.id), input.ids, t('edubridge.sections.reorderItems.levels'));
      for (const [i, id] of input.ids.entries()) {
        const level = levels.find((l) => l.id === id)!;
        if (level.sort_order !== i) await this.repo.saveLevel({ ...level, sort_order: i });
      }
    } else {
      const sections = await this.repo.list(coopname);
      assertSameSet(sections.map((s) => s.id), input.ids, t('edubridge.sections.reorderItems.sections'));
      for (const [i, id] of input.ids.entries()) {
        const section = sections.find((s) => s.id === id)!;
        if (section.sort_order !== i) await this.repo.saveSection({ id: section.id, coopname, title: section.title, sort_order: i, archived: section.archived });
      }
    }
    return this.list(coopname, { include_archived: true });
  }

  async archiveSection(coopname: string, id: string, archived: boolean): Promise<SectionWithLevels> {
    const section = await this.repo.findSection(coopname, id);
    if (!section) throw DomainError.notFound('EDUBRIDGE_SECTION_NOT_FOUND');
    section.archived = archived;
    return this.withLevels(await this.repo.saveSection(section));
  }

  async archiveLevel(coopname: string, id: string, archived: boolean): Promise<EdubridgeLevelEntity> {
    const level = await this.repo.findLevel(coopname, id);
    if (!level) throw DomainError.notFound('EDUBRIDGE_LEVEL_NOT_FOUND');
    level.archived = archived;
    return this.repo.saveLevel(level);
  }

  /**
   * Раздел и уровень для курса: существуют, уровень принадлежит разделу, и
   * новому выбору архивное не подходит — у курса, где оно уже стоит, остаётся.
   */
  async assertForCourse(coopname: string, sectionId: string, levelId: string | null | undefined, current?: { section_id: string | null; level_id: string | null }): Promise<void> {
    const section = await this.repo.findSection(coopname, sectionId);
    if (!section) throw DomainError.badRequest('EDUBRIDGE_SECTION_NOT_IN_CATALOG');
    if (section.archived && current?.section_id !== sectionId) throw DomainError.badRequest('EDUBRIDGE_SECTION_ARCHIVED', { title: section.title });
    if (!levelId) return;
    const level = await this.repo.findLevel(coopname, levelId);
    if (!level || level.section_id !== sectionId) throw DomainError.badRequest('EDUBRIDGE_LEVEL_NOT_IN_SECTION');
    if (level.archived && current?.level_id !== levelId) throw DomainError.badRequest('EDUBRIDGE_LEVEL_ARCHIVED', { title: level.title });
  }

  /**
   * Перенос курсов, где раздел и уровень лежат строками (до справочника):
   * пары становятся записями справочника, курсы — ссылками на них. Идемпотентно.
   */
  async migrateLegacyCourses(coopname: string): Promise<number> {
    const courses = await this.repo.unmigratedCourses(coopname);
    for (const course of courses) {
      const section = (await this.saveSection(coopname, { title: course.legacy_subject ?? '' })).section;
      const grade = clean(course.legacy_grade ?? '');
      const level = grade ? await this.saveLevel(coopname, { section_id: section.id, title: grade }) : null;
      await this.repo.linkCourse(course.id, section.id, level?.id ?? null);
    }
    return courses.length;
  }

  private async withLevels(section: EdubridgeSectionEntity): Promise<SectionWithLevels> {
    return { section, levels: await this.repo.levelsOf(section.id) };
  }
}

function clean(title: string): string {
  return String(title ?? '').trim().replace(/\s+/g, ' ');
}

function assertSameSet(existing: string[], next: string[], what: string): void {
  if (existing.length !== next.length || !existing.every((id) => next.includes(id))) {
    throw DomainError.badRequest('EDUBRIDGE_REORDER_INCOMPLETE', { items: what });
  }
}
