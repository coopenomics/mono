import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GeneratedReportEntity } from '../entities/generated-report.entity';
import type {
  CreateGeneratedReportInput,
  GeneratedReportFilter,
  GeneratedReportRecord,
  GeneratedReportRepository,
} from '../../domain/repositories/generated-report.repository';
import { ReportType } from '../../domain/enums/report-type.enum';

@Injectable()
export class GeneratedReportTypeormRepository implements GeneratedReportRepository {
  constructor(
    @InjectRepository(GeneratedReportEntity)
    private readonly repository: Repository<GeneratedReportEntity>
  ) {}

  async create(input: CreateGeneratedReportInput): Promise<GeneratedReportRecord> {
    const entity = this.repository.create({
      coopname: input.coopname,
      report_type: input.report_type,
      year: input.year,
      period: input.period ?? null,
      xml: input.xml,
      file_name: input.file_name,
      is_valid: input.is_valid,
      validation_errors: input.validation_errors ?? null,
      organization_snapshot: input.organization_snapshot,
      corrections_snapshot: input.corrections_snapshot ?? null,
      generated_by: input.generated_by,
    });
    const saved = await this.repository.save(entity);
    return this.toRecord(saved);
  }

  async findById(id: string): Promise<GeneratedReportRecord | null> {
    const entity = await this.repository.findOne({ where: { id } });
    return entity ? this.toRecord(entity) : null;
  }

  async findLatest(
    coopname: string,
    report_type: ReportType,
    year: number,
    period?: number | null
  ): Promise<GeneratedReportRecord | null> {
    // Если period не указан (undefined) — возвращаем самый свежий отчёт за год
    // независимо от периода (квартал/полугодие/год). Раньше при undefined
    // фильтровали `period IS NULL`, что скрывало квартальные отчёты (NDFL6, РСВ)
    // в карточке «последний сгенерированный».
    //
    // Если period === null — это явный запрос годовых (period IS NULL в БД).
    // Если period — число — точное совпадение.
    const qb = this.repository.createQueryBuilder('r')
      .where('r.coopname = :coopname', { coopname })
      .andWhere('r.report_type = :report_type', { report_type })
      .andWhere('r.year = :year', { year })
      .orderBy('r.created_at', 'DESC')
      .limit(1);

    if (period === null) {
      qb.andWhere('r.period IS NULL');
    } else if (typeof period === 'number') {
      qb.andWhere('r.period = :period', { period });
    }
    // period === undefined — без фильтра, любой период.

    const entity = await qb.getOne();
    return entity ? this.toRecord(entity) : null;
  }

  async list(
    filter: GeneratedReportFilter,
    limit: number,
    offset: number
  ): Promise<{ items: GeneratedReportRecord[]; total: number }> {
    const qb = this.repository.createQueryBuilder('r')
      .where('r.coopname = :coopname', { coopname: filter.coopname })
      .orderBy('r.created_at', 'DESC')
      .skip(offset)
      .take(limit);

    if (filter.report_type) qb.andWhere('r.report_type = :rt', { rt: filter.report_type });
    if (filter.year !== undefined) qb.andWhere('r.year = :year', { year: filter.year });
    // period: null → period IS NULL (явно годовые); число → точное совпадение;
    // undefined → не фильтруем.
    if (filter.period === null) {
      qb.andWhere('r.period IS NULL');
    } else if (typeof filter.period === 'number') {
      qb.andWhere('r.period = :period', { period: filter.period });
    }

    const [entities, total] = await qb.getManyAndCount();
    return { items: entities.map((e) => this.toRecord(e)), total };
  }

  private toRecord(entity: GeneratedReportEntity): GeneratedReportRecord {
    return {
      id: entity.id,
      coopname: entity.coopname,
      report_type: entity.report_type,
      year: entity.year,
      period: entity.period ?? null,
      xml: entity.xml,
      file_name: entity.file_name,
      is_valid: entity.is_valid,
      validation_errors: entity.validation_errors ?? null,
      organization_snapshot: entity.organization_snapshot,
      corrections_snapshot: entity.corrections_snapshot ?? null,
      generated_by: entity.generated_by,
      created_at: entity.created_at,
    };
  }
}
