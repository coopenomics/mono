import { Inject, Injectable } from '@nestjs/common';
import { attachOne, PaginationInputDTO, type PaginationResult, PaginationUtils, TableStore } from '@coopenomics/extension-kit';
import { EDUBRIDGE_COURSE_STORE, EDUBRIDGE_LEVEL_STORE, EDUBRIDGE_SECTION_STORE } from '../database/edubridge-stores';
import { EduCourseStatus } from '../../domain/enums';
import { EdubridgeCourseRecord, EdubridgeLevelRecord, EdubridgeSectionRecord } from '../entities';

export interface EduCourseFilter {
  section_id?: string;
  level_id?: string;
  status?: EduCourseStatus;
}

const SORTABLE = new Set(['title', 'sort_order', 'created_at', 'updated_at']);

/** Связи справочника не колонки курса: в базу они не пишутся. */
type CourseRow = Omit<EdubridgeCourseRecord, 'section' | 'level'>;

@Injectable()
export class EdubridgeCourseKyselyRepository {
  constructor(
    @Inject(EDUBRIDGE_COURSE_STORE)
    private readonly repo: TableStore<EdubridgeCourseRecord>,
    @Inject(EDUBRIDGE_SECTION_STORE)
    private readonly sections: TableStore<EdubridgeSectionRecord>,
    @Inject(EDUBRIDGE_LEVEL_STORE)
    private readonly levels: TableStore<EdubridgeLevelRecord>
  ) {}

  /** Раздел и уровень курса — записи справочника: подгружаются к каждой выборке курсов. */
  private async withCatalog<T extends EdubridgeCourseRecord | null>(found: T | EdubridgeCourseRecord[]): Promise<void> {
    const courses = Array.isArray(found) ? found : found ? [found] : [];
    await attachOne(courses, this.sections, 'section', { id: 'section_id' });
    await attachOne(courses, this.levels, 'level', { id: 'level_id' });
  }

  async findPage(
    coopname: string,
    filter: EduCourseFilter,
    options?: PaginationInputDTO
  ): Promise<PaginationResult<EdubridgeCourseRecord>> {
    const validated = PaginationUtils.validatePaginationOptions(options ?? ({ page: 1, limit: 24, sortOrder: 'ASC' } as PaginationInputDTO));
    const { limit, offset } = PaginationUtils.getSqlPaginationParams(validated);
    const sortBy = validated.sortBy && SORTABLE.has(validated.sortBy) ? validated.sortBy : 'sort_order';

    const qb = this.repo
      .sqlBuilder('c')
      .leftJoin(this.sections.table, 'sec', 'sec.id = c.section_id')
      .leftJoin(this.levels.table, 'lvl', 'lvl.id = c.level_id')
      .where('c.coopname = :coopname', { coopname });
    if (filter.section_id) qb.andWhere('c.section_id = :section_id', { section_id: filter.section_id });
    if (filter.level_id) qb.andWhere('c.level_id = :level_id', { level_id: filter.level_id });
    if (filter.status) qb.andWhere('c.status = :status', { status: filter.status });
    if (sortBy === 'sort_order') {
      // Порядок по умолчанию — порядок справочника: раздел, уровень, затем курс.
      // Курсы без раздела — в конце, без уровня — в начале раздела.
      qb.orderBy('(sec.sort_order IS NULL)', 'ASC')
        .addOrderBy('sec.sort_order', 'ASC')
        .addOrderBy('(lvl.sort_order IS NOT NULL)', 'ASC')
        .addOrderBy('lvl.sort_order', 'ASC')
        .addOrderBy('c.sort_order', validated.sortOrder);
    } else {
      qb.orderBy(`c.${sortBy}`, validated.sortOrder);
    }
    qb.addOrderBy('c.title', 'ASC').offset(offset).limit(limit);

    const [items, totalCount] = await qb.getManyAndCount();
    await this.withCatalog(items);
    return PaginationUtils.createPaginationResult(items, totalCount, validated);
  }

  async findById(coopname: string, id: string): Promise<EdubridgeCourseRecord | null> {
    const course = await this.repo.findOne({ coopname, id });
    await this.withCatalog(course);
    return course;
  }

  /** Все курсы кооператива — для сверки назначений при запуске. */
  async listAll(coopname: string): Promise<EdubridgeCourseRecord[]> {
    const courses = await this.repo.find({ coopname });
    await this.withCatalog(courses);
    return courses;
  }

  create(data: Partial<EdubridgeCourseRecord>): EdubridgeCourseRecord {
    return this.repo.create(data);
  }

  async save(entity: EdubridgeCourseRecord): Promise<EdubridgeCourseRecord> {
    const { section: _section, level: _level, ...row } = entity;
    const saved = Object.assign(entity, await this.repo.save(row as CourseRow));
    saved.section = undefined;
    saved.level = undefined;
    await this.withCatalog(saved);
    return saved;
  }
}
