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

  async markApplied(eventId: string): Promise<void> {
    // ON CONFLICT DO NOTHING: повторная отметка (re-delivery / crash-recovery)
    // не должна падать на нарушении PK.
    await this.repository
      .createQueryBuilder()
      .insert()
      .into(ConsumerDedupEntity)
      .values({ event_id: eventId })
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
}
