import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { InvalidatedEntityTypeormEntity } from '../entities/invalidated-entity.typeorm-entity';

export interface InvalidatedEntityRecord {
  entity_table: string;
  entity_id: string;
  data: Record<string, any>;
  invalidated_by_block: number;
  fork_event_id?: string | null;
}

/**
 * Репозиторий архива снесённых форком live-сущностей (Story 4.4).
 */
@Injectable()
export class InvalidatedEntityRepository {
  constructor(
    @InjectRepository(InvalidatedEntityTypeormEntity)
    private readonly repository: Repository<InvalidatedEntityTypeormEntity>
  ) {}

  async bulkInsert(records: InvalidatedEntityRecord[]): Promise<number> {
    if (records.length === 0) return 0;
    const entities = records.map((r) => this.repository.create(r));
    const saved = await this.repository.save(entities);
    return saved.length;
  }

  /**
   * Retention: удалить архив старше указанного блока. Делается отдельной транзакцией,
   * не транзакционно с архивированием — это фоновая очистка.
   */
  async deleteOlderThan(minInvalidatedByBlock: number): Promise<number> {
    const result = await this.repository.delete({
      invalidated_by_block: LessThan(minInvalidatedByBlock),
    });
    return result.affected ?? 0;
  }

  /**
   * Forensic-read для AC «список из invalidated_entities, сгруппированный по fork_event_id».
   * UI/CLI обёртка — Epic 9 (out of scope 4.4); сам repository-метод доступен из backend-кода.
   */
  async findGroupedByForkEventId(opts: {
    blockNum?: number;
    limit?: number;
  }): Promise<Map<string | null, InvalidatedEntityTypeormEntity[]>> {
    const qb = this.repository
      .createQueryBuilder('inv')
      .orderBy('inv.fork_event_id', 'ASC')
      .addOrderBy('inv.created_at', 'DESC');

    if (opts.blockNum != null) {
      qb.where('inv.invalidated_by_block = :blockNum', { blockNum: opts.blockNum });
    }
    if (opts.limit != null) {
      qb.limit(opts.limit);
    }

    const rows = await qb.getMany();
    const grouped = new Map<string | null, InvalidatedEntityTypeormEntity[]>();
    for (const row of rows) {
      const key = row.fork_event_id ?? null;
      const bucket = grouped.get(key) ?? [];
      bucket.push(row);
      grouped.set(key, bucket);
    }
    return grouped;
  }
}
