import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { ReportSubmissionMarkEntity } from '../entities/report-submission-mark.entity';
import type {
  ReportSubmissionMarkFilter,
  ReportSubmissionMarkRecord,
  ReportSubmissionMarkRepository,
} from '../../domain/repositories/report-submission-mark.repository';
import { ReportType } from '../../domain/enums/report-type.enum';
import { ReportSubmissionMark } from '../../domain/enums/report-submission-mark.enum';

@Injectable()
export class ReportSubmissionMarkTypeormRepository implements ReportSubmissionMarkRepository {
  constructor(
    @InjectRepository(ReportSubmissionMarkEntity)
    private readonly repository: Repository<ReportSubmissionMarkEntity>,
  ) {}

  async set(input: {
    coopname: string;
    report_type: ReportType;
    year: number;
    period?: number | null;
    mark: ReportSubmissionMark;
    created_by: string;
  }): Promise<ReportSubmissionMarkRecord> {
    // Ручной upsert: UNIQUE-индекс включает nullable `period`,
    // TypeORM `upsert` с onConflict нестабилен на null-ключах
    // (такая же логика, как в ReportDraftTypeormRepository).
    const existing = await this.repository.findOne({
      where: {
        coopname: input.coopname,
        report_type: input.report_type,
        year: input.year,
        period: input.period ?? IsNull(),
      },
    });
    if (existing) {
      existing.mark = input.mark;
      existing.created_by = input.created_by;
      const saved = await this.repository.save(existing);
      return this.toRecord(saved);
    }
    const entity = this.repository.create({
      coopname: input.coopname,
      report_type: input.report_type,
      year: input.year,
      period: input.period ?? null,
      mark: input.mark,
      created_by: input.created_by,
    });
    const saved = await this.repository.save(entity);
    return this.toRecord(saved);
  }

  async findOne(
    coopname: string,
    report_type: ReportType,
    year: number,
    period?: number | null,
  ): Promise<ReportSubmissionMarkRecord | null> {
    const entity = await this.repository.findOne({
      where: {
        coopname,
        report_type,
        year,
        period: period ?? IsNull(),
      },
    });
    return entity ? this.toRecord(entity) : null;
  }

  async list(filter: ReportSubmissionMarkFilter): Promise<ReportSubmissionMarkRecord[]> {
    const qb = this.repository
      .createQueryBuilder('m')
      .where('m.coopname = :coopname', { coopname: filter.coopname });
    if (filter.report_type) qb.andWhere('m.report_type = :rt', { rt: filter.report_type });
    if (filter.year !== undefined) qb.andWhere('m.year = :year', { year: filter.year });
    if (filter.period === null) {
      qb.andWhere('m.period IS NULL');
    } else if (typeof filter.period === 'number') {
      qb.andWhere('m.period = :period', { period: filter.period });
    }
    const entities = await qb.getMany();
    return entities.map((e) => this.toRecord(e));
  }

  async remove(
    coopname: string,
    report_type: ReportType,
    year: number,
    period?: number | null,
  ): Promise<boolean> {
    const qb = this.repository
      .createQueryBuilder()
      .delete()
      .from(ReportSubmissionMarkEntity)
      .where('coopname = :coopname', { coopname })
      .andWhere('report_type = :rt', { rt: report_type })
      .andWhere('year = :year', { year });
    if (period === null || period === undefined) {
      qb.andWhere('period IS NULL');
    } else {
      qb.andWhere('period = :period', { period });
    }
    const result = await qb.execute();
    return (result.affected ?? 0) > 0;
  }

  private toRecord(entity: ReportSubmissionMarkEntity): ReportSubmissionMarkRecord {
    return {
      id: entity.id,
      coopname: entity.coopname,
      report_type: entity.report_type,
      year: entity.year,
      period: entity.period ?? null,
      mark: entity.mark,
      created_by: entity.created_by,
      created_at: entity.created_at,
      updated_at: entity.updated_at,
    };
  }
}
