import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { ReportDraftEntity } from '../entities/report-draft.entity';
import type {
  ReportDraftFilter,
  ReportDraftRecord,
  ReportDraftRepository,
  SaveReportDraftInput,
} from '../../domain/repositories/report-draft.repository';
import { ReportType } from '../../domain/enums/report-type.enum';

@Injectable()
export class ReportDraftTypeormRepository implements ReportDraftRepository {
  constructor(
    @InjectRepository(ReportDraftEntity)
    private readonly repository: Repository<ReportDraftEntity>,
  ) {}

  async save(input: SaveReportDraftInput): Promise<ReportDraftRecord> {
    // Upsert вручную: уникальный индекс составной и включает nullable `period`,
    // поэтому TypeORM `upsert` с onConflict работает нестабильно для null-ключей.
    const existing = await this.repository.findOne({
      where: {
        coopname: input.coopname,
        owner_username: input.owner_username,
        report_type: input.report_type,
        year: input.year,
        period: input.period ?? IsNull(),
      },
    });

    if (existing) {
      existing.edits_json = input.edits_json;
      existing.edited_fields = input.edited_fields;
      const saved = await this.repository.save(existing);
      return this.toRecord(saved);
    }

    const entity = this.repository.create({
      coopname: input.coopname,
      owner_username: input.owner_username,
      report_type: input.report_type,
      year: input.year,
      period: input.period ?? null,
      edits_json: input.edits_json,
      edited_fields: input.edited_fields,
    });
    const saved = await this.repository.save(entity);
    return this.toRecord(saved);
  }

  async findById(id: string): Promise<ReportDraftRecord | null> {
    const entity = await this.repository.findOne({ where: { id } });
    return entity ? this.toRecord(entity) : null;
  }

  async findOne(
    coopname: string,
    owner_username: string,
    report_type: ReportType,
    year: number,
    period?: number | null,
  ): Promise<ReportDraftRecord | null> {
    const entity = await this.repository.findOne({
      where: {
        coopname,
        owner_username,
        report_type,
        year,
        period: period ?? IsNull(),
      },
    });
    return entity ? this.toRecord(entity) : null;
  }

  async list(filter: ReportDraftFilter): Promise<ReportDraftRecord[]> {
    const qb = this.repository
      .createQueryBuilder('d')
      .where('d.coopname = :coopname', { coopname: filter.coopname })
      .andWhere('d.owner_username = :owner_username', { owner_username: filter.owner_username })
      .orderBy('d.updated_at', 'DESC');

    if (filter.report_type) qb.andWhere('d.report_type = :rt', { rt: filter.report_type });
    if (filter.year !== undefined) qb.andWhere('d.year = :year', { year: filter.year });
    if (filter.period === null) {
      qb.andWhere('d.period IS NULL');
    } else if (typeof filter.period === 'number') {
      qb.andWhere('d.period = :period', { period: filter.period });
    }

    const entities = await qb.getMany();
    return entities.map((e) => this.toRecord(e));
  }

  async delete(id: string, coopname: string, owner_username: string): Promise<boolean> {
    // coopname+owner_username в WHERE — защита от удаления чужого drafta
    // даже если клиент угадал UUID.
    const result = await this.repository
      .createQueryBuilder()
      .delete()
      .from(ReportDraftEntity)
      .where('id = :id', { id })
      .andWhere('coopname = :coopname', { coopname })
      .andWhere('owner_username = :owner_username', { owner_username })
      .execute();
    return (result.affected ?? 0) > 0;
  }

  private toRecord(entity: ReportDraftEntity): ReportDraftRecord {
    return {
      id: entity.id,
      coopname: entity.coopname,
      owner_username: entity.owner_username,
      report_type: entity.report_type,
      year: entity.year,
      period: entity.period ?? null,
      edits_json: entity.edits_json,
      edited_fields: entity.edited_fields ?? [],
      created_at: entity.created_at,
      updated_at: entity.updated_at,
    };
  }
}
