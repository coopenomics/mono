import { Inject, Injectable } from '@nestjs/common';
import { sql, type Kysely, type Selectable } from 'kysely';
import { KYSELY, snakeRow } from '@coopenomics/extension-kit';
import type { ChatcoopStateDomainEntity } from '../../domain/entities/chatcoop-state.entity';
import { CHATCOOP_STATE_SINGLETON_ID } from '../../domain/chatcoop-state.constants';
import type { ChatcoopStateMergeInput, ChatcoopStateRepository } from '../../domain/repositories/chatcoop-state.repository';
import type { ChatcoopState, DB } from '../database/chatcoop.database.types';

function toDomain(row: Selectable<ChatcoopState>): ChatcoopStateDomainEntity {
  return {
    id: row.id,
    spaceId: row.space_id,
    isInitialized: row.is_initialized,
    secretaryMatrixUserId: row.secretary_matrix_user_id,
    secretaryInitialized: row.secretary_initialized,
    secretaryUsername: row.secretary_username,
    secretaryPasswordEncrypted: row.secretary_password_encrypted,
  };
}

/** Состояние чата кооператива — одна строка на узел (таблица `chatcoop_state`). */
@Injectable()
export class ChatcoopStateKyselyRepository implements ChatcoopStateRepository {
  constructor(@Inject(KYSELY) private readonly db: Kysely<DB>) {}

  async getSingleton(): Promise<ChatcoopStateDomainEntity> {
    return toDomain(await this.loadOrCreateRow());
  }

  /** Правятся только переданные поля. */
  async merge(input: ChatcoopStateMergeInput): Promise<ChatcoopStateDomainEntity> {
    await this.loadOrCreateRow();
    const { spaceId, isInitialized, secretaryMatrixUserId, secretaryInitialized, secretaryUsername, secretaryPasswordEncrypted } = input;
    const row = await this.db
      .updateTable('chatcoop_state')
      .set({
        ...snakeRow({ spaceId, isInitialized, secretaryMatrixUserId, secretaryInitialized, secretaryUsername, secretaryPasswordEncrypted }),
        updated_at: sql`now()`,
      })
      .where('id', '=', CHATCOOP_STATE_SINGLETON_ID)
      .returningAll()
      .executeTakeFirstOrThrow();
    return toDomain(row);
  }

  private async loadOrCreateRow(): Promise<Selectable<ChatcoopState>> {
    await this.db
      .insertInto('chatcoop_state')
      .values({ id: CHATCOOP_STATE_SINGLETON_ID, is_initialized: false, secretary_initialized: false })
      .onConflict((conflict) => conflict.column('id').doNothing())
      .execute();
    return this.db.selectFrom('chatcoop_state').selectAll().where('id', '=', CHATCOOP_STATE_SINGLETON_ID).executeTakeFirstOrThrow();
  }
}
