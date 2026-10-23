import { Inject, Injectable } from '@nestjs/common';
import type { ConsumerDedupRepositoryPort } from '~/domain/parser/ports/consumer-dedup-repository.port';
import { KYSELY, type Database } from '../kysely.tokens';

/** Отметки применённых событий цепи — защита от повторной доставки (таблица `consumer_dedup`). */
@Injectable()
export class ConsumerDedupKyselyRepository implements ConsumerDedupRepositoryPort {
  constructor(@Inject(KYSELY) private readonly db: Database) {}

  async isApplied(eventId: string): Promise<boolean> {
    const row = await this.db.selectFrom('consumer_dedup').select('event_id').where('event_id', '=', eventId).executeTakeFirst();
    return row != null;
  }

  /** Повторная отметка (повторная доставка, восстановление после сбоя) не ошибка. */
  async markApplied(eventId: string, blockNum?: number): Promise<void> {
    await this.db
      .insertInto('consumer_dedup')
      .values({ event_id: eventId, block_num: typeof blockNum === 'number' ? String(blockNum) : null })
      .onConflict((conflict) => conflict.doNothing())
      .execute();
  }

  async deleteOlderThan(cutoff: Date): Promise<number> {
    const result = await this.db.deleteFrom('consumer_dedup').where('applied_at', '<', cutoff).executeTakeFirst();
    return Number(result.numDeletedRows ?? 0);
  }

  /** Отметки без номера блока (старые записи) форком не снимаются: сравнение с пустым значением ложно. */
  async deleteAfterBlock(blockNum: number): Promise<number> {
    const result = await this.db.deleteFrom('consumer_dedup').where('block_num', '>', String(blockNum)).executeTakeFirst();
    return Number(result.numDeletedRows ?? 0);
  }
}
