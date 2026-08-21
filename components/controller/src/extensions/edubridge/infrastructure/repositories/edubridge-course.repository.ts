import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaginationInputDTO, PaginationUtils, type PaginationResult } from '@coopenomics/extension-kit';
import { EduCourseStatus } from '../../domain/enums';
import { EdubridgeCourseEntity } from '../entities';

export interface EduCourseFilter {
  subject?: string;
  grade?: string;
  status?: EduCourseStatus;
}

const SORTABLE = new Set(['title', 'subject', 'grade', 'sort_order', 'created_at', 'updated_at']);

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

    const qb = this.repo.createQueryBuilder('c').where('c.coopname = :coopname', { coopname });
    if (filter.subject) qb.andWhere('c.subject = :subject', { subject: filter.subject });
    if (filter.grade) qb.andWhere('c.grade = :grade', { grade: filter.grade });
    if (filter.status) qb.andWhere('c.status = :status', { status: filter.status });
    qb.orderBy(`c.${sortBy}`, validated.sortOrder).addOrderBy('c.title', 'ASC').skip(offset).take(limit);

    const [items, totalCount] = await qb.getManyAndCount();
    return PaginationUtils.createPaginationResult(items, totalCount, validated);
  }

  async findById(coopname: string, id: string): Promise<EdubridgeCourseEntity | null> {
    return this.repo.findOne({ where: { coopname, id } });
  }

  /** Предметы и классы, по которым есть опубликованные курсы — для иерархии каталога. */
  async listSubjects(coopname: string): Promise<Array<{ subject: string; grade: string }>> {
    return this.repo
      .createQueryBuilder('c')
      .select('c.subject', 'subject')
      .addSelect('c.grade', 'grade')
      .where('c.coopname = :coopname AND c.status = :status', { coopname, status: EduCourseStatus.PUBLISHED })
      .groupBy('c.subject')
      .addGroupBy('c.grade')
      .orderBy('c.subject', 'ASC')
      .addOrderBy('c.grade', 'ASC')
      .getRawMany();
  }

  create(data: Partial<EdubridgeCourseEntity>): EdubridgeCourseEntity {
    return this.repo.create(data);
  }

  save(entity: EdubridgeCourseEntity): Promise<EdubridgeCourseEntity> {
    return this.repo.save(entity);
  }
}
