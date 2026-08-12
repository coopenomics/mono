import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { InvalidatedEntityVersionTypeormEntity } from '../entities/invalidated-entity-version.typeorm-entity';

export interface InvalidatedEntityVersionRecord {
  entity_table: string;
  entity_id: string;
  previous_data: Record<string, any>;
  original_block_num?: number | null;
  invalidated_by_block: number;
  fork_event_id?: string | null;
  change_type: string;
  metadata?: Record<string, any> | null;
}

/**
 * Репозиторий архива снесённых форком версий-снимков entity_versions (Story 4.4).
 */
@Injectable()
export class InvalidatedEntityVersionRepository {
  constructor(
    @InjectRepository(InvalidatedEntityVersionTypeormEntity)
    private readonly repository: Repository<InvalidatedEntityVersionTypeormEntity>
  ) {}

  async bulkInsert(records: InvalidatedEntityVersionRecord[]): Promise<number> {
    if (records.length === 0) return 0;
    const entities = records.map((r) => this.repository.create(r));
    const saved = await this.repository.save(entities);
    return saved.length;
  }

  async deleteOlderThan(minInvalidatedByBlock: number): Promise<number> {
    const result = await this.repository.delete({
      invalidated_by_block: LessThan(minInvalidatedByBlock),
    });
    return result.affected ?? 0;
  }
}
