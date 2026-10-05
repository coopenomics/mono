import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'kysely';
import type { SyncStateRepositoryPort } from '~/domain/parser/ports/sync-state-repository.port';
import { KYSELY, type Database } from '../kysely.tokens';

const CURRENT_BLOCK = 'currentBlock';

/** Отметка последнего обработанного блока (таблица `blockchain_sync_state`). */
@Injectable()
export class BlockchainSyncStateKyselyRepository implements SyncStateRepositoryPort {
  constructor(@Inject(KYSELY) private readonly db: Database) {}

  async getCurrentBlock(): Promise<number> {
    const row = await this.db
      .selectFrom('blockchain_sync_state')
      .select('block_num')
      .where('key', '=', CURRENT_BLOCK)
      .executeTakeFirst();
    return row ? Number(row.block_num) : 0;
  }

  async updateCurrentBlock(blockNum: number): Promise<void> {
    await this.db
      .insertInto('blockchain_sync_state')
      .values({ key: CURRENT_BLOCK, block_num: blockNum })
      .onConflict((conflict) => conflict.column('key').doUpdateSet({ block_num: blockNum, updated_at: sql`now()` }))
      .execute();
  }
}
