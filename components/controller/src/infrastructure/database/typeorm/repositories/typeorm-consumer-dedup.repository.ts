import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { ConsumerDedupRepositoryPort } from '~/domain/parser/ports/consumer-dedup-repository.port';
import { ConsumerDedupEntity } from '../entities/consumer-dedup.entity';

/**
 * TypeORM-реализация списка применённых событий (Story 2.1).
 */
@Injectable()
export class TypeOrmConsumerDedupRepository implements ConsumerDedupRepositoryPort {
  constructor(
    @InjectRepository(ConsumerDedupEntity)
    private readonly repository: Repository<ConsumerDedupEntity>
  ) {}

  async isApplied(eventId: string): Promise<boolean> {
    const found = await this.repository.findOne({
      where: { event_id: eventId },
      select: { event_id: true },
    });
    return found != null;
  }

  async markApplied(eventId: string, blockNum?: number): Promise<void> {
    // ON CONFLICT DO NOTHING: повторная отметка (re-delivery / crash-recovery)
    // не должна падать на нарушении PK.
    // block_num хранится как bigint → string в TypeORM; NULL для legacy-вызовов без блока.
    await this.repository
      .createQueryBuilder()
      .insert()
      .into(ConsumerDedupEntity)
      .values({
        event_id: eventId,
        block_num: typeof blockNum === 'number' ? String(blockNum) : null,
      })
      .orIgnore()
      .execute();
  }

  async deleteOlderThan(cutoff: Date): Promise<number> {
    const result = await this.repository
      .createQueryBuilder()
      .delete()
      .from(ConsumerDedupEntity)
      .where('applied_at < :cutoff', { cutoff })
      .execute();
    return result.affected ?? 0;
  }

  async deleteAfterBlock(blockNum: number): Promise<number> {
    // Сравнение bigint > N — оба операнда числа на стороне PG; параметр приводится в bigint.
    // NULL-записи (legacy до Story 4.1) не попадают: NULL > N = UNKNOWN, строка не удаляется.
    const result = await this.repository
      .createQueryBuilder()
      .delete()
      .from(ConsumerDedupEntity)
      .where('block_num > :blockNum', { blockNum })
      .execute();
    return result.affected ?? 0;
  }
}
