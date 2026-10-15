import { Inject, Injectable } from '@nestjs/common';
import type { Kysely } from 'kysely';
import { KYSELY, camelRow } from '@coopenomics/extension-kit';
import { UnionChatRepository } from '../../domain/repositories/union-chat.repository';
import { UnionChatDomainEntity } from '../../domain/entities/union-chat.entity';
import type { DB } from '../database/chatcoop.database.types';

/** Чаты пайщика с представителем союза (таблица `union_chats`). */
@Injectable()
export class UnionChatKyselyRepository implements UnionChatRepository {
  constructor(@Inject(KYSELY) private readonly db: Kysely<DB>) {}

  async create(data: Omit<UnionChatDomainEntity, 'id' | 'createdAt'>): Promise<UnionChatDomainEntity> {
    const row = await this.db
      .insertInto('union_chats')
      .values({
        coop_username: data.coopUsername,
        matrix_user_id: data.matrixUserId,
        room_id: data.roomId,
        union_person_id: data.unionPersonId,
        union_name: data.unionName,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return camelRow<UnionChatDomainEntity>(row);
  }

  async findByCoopUsername(coopUsername: string): Promise<UnionChatDomainEntity | null> {
    const row = await this.db.selectFrom('union_chats').selectAll().where('coop_username', '=', coopUsername).executeTakeFirst();
    return row ? camelRow<UnionChatDomainEntity>(row) : null;
  }

  async findByRoomId(roomId: string): Promise<UnionChatDomainEntity | null> {
    const row = await this.db.selectFrom('union_chats').selectAll().where('room_id', '=', roomId).executeTakeFirst();
    return row ? camelRow<UnionChatDomainEntity>(row) : null;
  }
}
