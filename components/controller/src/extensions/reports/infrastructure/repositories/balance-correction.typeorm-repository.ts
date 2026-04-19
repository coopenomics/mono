import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BalanceCorrectionEntity } from '../entities/balance-correction.entity';
import type {
  BalanceCorrectionRecord,
  BalanceCorrectionRepository,
  UpsertBalanceCorrectionInput,
} from '../../domain/repositories/balance-correction.repository';

@Injectable()
export class BalanceCorrectionTypeormRepository implements BalanceCorrectionRepository {
  constructor(
    @InjectRepository(BalanceCorrectionEntity)
    private readonly repository: Repository<BalanceCorrectionEntity>
  ) {}

  async upsert(input: UpsertBalanceCorrectionInput): Promise<BalanceCorrectionRecord> {
    const toSave = {
      coopname: input.coopname,
      year: input.year,
      account_display_id: input.account_display_id,
      balance_previous: String(input.balance_previous),
      balance_pre_previous: String(input.balance_pre_previous),
      updated_by: input.updated_by,
    };

    await this.repository.upsert(toSave, {
      conflictPaths: ['coopname', 'year', 'account_display_id'],
      skipUpdateIfNoValuesChanged: false,
    });

    const saved = await this.repository.findOne({
      where: {
        coopname: input.coopname,
        year: input.year,
        account_display_id: input.account_display_id,
      },
    });
    if (!saved) {
      throw new Error('balance_correction upsert: запись не найдена после upsert');
    }
    return this.toRecord(saved);
  }

  async upsertMany(inputs: UpsertBalanceCorrectionInput[]): Promise<BalanceCorrectionRecord[]> {
    if (inputs.length === 0) return [];

    // Bulk upsert атомарно — либо все строки сохранены, либо ни одна.
    // Раньше был `for`-цикл с отдельным INSERT на каждую позицию, частичный сбой
    // оставлял половину корректировок в БД.
    const rows = inputs.map((input) => ({
      coopname: input.coopname,
      year: input.year,
      account_display_id: input.account_display_id,
      balance_previous: String(input.balance_previous),
      balance_pre_previous: String(input.balance_pre_previous),
      updated_by: input.updated_by,
    }));
    await this.repository.upsert(rows, {
      conflictPaths: ['coopname', 'year', 'account_display_id'],
      skipUpdateIfNoValuesChanged: false,
    });

    const saved = await this.repository.find({
      where: inputs.map((input) => ({
        coopname: input.coopname,
        year: input.year,
        account_display_id: input.account_display_id,
      })),
    });
    return saved.map((e) => this.toRecord(e));
  }

  async findForYear(coopname: string, year: number): Promise<BalanceCorrectionRecord[]> {
    const entities = await this.repository.find({
      where: { coopname, year },
      order: { account_display_id: 'ASC' },
    });
    return entities.map((e) => this.toRecord(e));
  }

  async findOne(coopname: string, year: number, account_display_id: string): Promise<BalanceCorrectionRecord | null> {
    const entity = await this.repository.findOne({
      where: { coopname, year, account_display_id },
    });
    return entity ? this.toRecord(entity) : null;
  }

  private toRecord(entity: BalanceCorrectionEntity): BalanceCorrectionRecord {
    return {
      id: entity.id,
      coopname: entity.coopname,
      year: entity.year,
      account_display_id: entity.account_display_id,
      balance_previous: entity.balance_previous,
      balance_pre_previous: entity.balance_pre_previous,
      updated_by: entity.updated_by,
      updated_at: entity.updated_at,
    };
  }
}
