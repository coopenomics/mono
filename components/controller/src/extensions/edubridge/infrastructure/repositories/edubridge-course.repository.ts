import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaginationInputDTO, PaginationUtils, type PaginationResult } from '@coopenomics/extension-kit';
import { EduCourseStatus } from '../../domain/enums';
import { EdubridgeCourseEntity } from '../entities';

export interface EduCourseFilter {
  section_id?: string;
  level_id?: string;
  status?: EduCourseStatus;
}

const SORTABLE = new Set(['title', 'sort_order', 'created_at', 'updated_at']);

@Injectable()
export class EdubridgeCourseRepository {
  constructor(@InjectRepository(EdubridgeCourseEntity) private readonly repo: Repository<EdubridgeCourseEntity>) {}

  async findPage(
    coopname: string,
    filter: EduCourseFilter,
    options?: PaginationInputDTO
  ): Promise<PaginationResult<EdubridgeCourseEntity>> {
    const validated = PaginationUtils.validatePaginationOptions(options ?? ({ page: 1, limit: 24, sortOrder: 'ASC' } as PaginationInputDTO));
    const { limit, offset } = PaginationUtils.getSqlPaginationParams(validated);
    const sortBy = validated.sortBy && SORTABLE.has(validated.sortBy) ? validated.sortBy : 'sort_order';

    // Раздел и уровень — связи справочника; построитель запросов подгружает их явно.
    const qb = this.repo
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.section', 'section')
      .leftJoinAndSelect('c.level', 'level')
      .where('c.coopname = :coopname', { coopname });
    if (filter.section_id) qb.andWhere('c.section_id = :section_id', { section_id: filter.section_id });
    if (filter.level_id) qb.andWhere('c.level_id = :level_id', { level_id: filter.level_id });
    if (filter.status) qb.andWhere('c.status = :status', { status: filter.status });
    if (sortBy === 'sort_order') {
      // Порядок по умолчанию — порядок справочника: раздел, уровень, затем курс.
      qb.orderBy('section.sort_order', 'ASC', 'NULLS LAST').addOrderBy('level.sort_order', 'ASC', 'NULLS FIRST').addOrderBy('c.sort_order', validated.sortOrder);
    } else {
      qb.orderBy(`c.${sortBy}`, validated.sortOrder);
    }
    qb.addOrderBy('c.title', 'ASC').skip(offset).take(limit);

    const [items, totalCount] = await qb.getManyAndCount();
    return PaginationUtils.createPaginationResult(items, totalCount, validated);
  }

  async findById(coopname: string, id: string): Promise<EdubridgeCourseEntity | null> {
    return this.repo.findOne({ where: { coopname, id } });
  }

  /** Все курсы кооператива — для сверки назначений при запуске. */
  listAll(coopname: string): Promise<EdubridgeCourseEntity[]> {
    return this.repo.find({ where: { coopname } });
  }



  create(data: Partial<EdubridgeCourseEntity>): EdubridgeCourseEntity {
    return this.repo.create(data);
  }

  save(entity: EdubridgeCourseEntity): Promise<EdubridgeCourseEntity> {
    return this.repo.save(entity);
  }
}
