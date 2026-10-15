import { Inject, Injectable } from '@nestjs/common';
import { sql, type Kysely } from 'kysely';
import { KYSELY, camelRow } from '@coopenomics/extension-kit';
import {
  RoomMessageHistoryRepository,
  RoomMessageHistoryInsertInput,
} from '../../domain/repositories/room-message-history.repository';
import type { RoomMessageHistoryDomainEntity } from '../../domain/entities/room-message-history.entity';
import type { DB } from '../database/chatcoop.database.types';

/** Дата сообщения по UTC из времени сервера чата (миллисекунды). */
const UTC_DATE = sql<string>`to_char((to_timestamp(origin_server_ts / 1000.0) AT TIME ZONE 'UTC')::date, 'YYYY-MM-DD')`;

/** История сообщений комнат чата (таблица `chatcoop_room_message_history`). */
@Injectable()
export class RoomMessageHistoryKyselyRepository implements RoomMessageHistoryRepository {
  constructor(@Inject(KYSELY) private readonly db: Kysely<DB>) {}

  async listDistinctUtcDatesWithNewMessagesAfter(matrixRoomId: string, afterOriginServerTsExclusive: number): Promise<string[]> {
    const rows = await this.db
      .selectFrom('chatcoop_room_message_history')
      .select(UTC_DATE.as('d'))
      .distinct()
      .where('matrix_room_id', '=', matrixRoomId)
      .where('origin_server_ts', '>', String(afterOriginServerTsExclusive))
      .orderBy('d')
      .execute();
    return rows.map((row) => row.d);
  }

  async listMessagesForRoomOnUtcDate(matrixRoomId: string, utcDate: string): Promise<RoomMessageHistoryDomainEntity[]> {
    const rows = await this.db
      .selectFrom('chatcoop_room_message_history')
      .selectAll()
      .where('matrix_room_id', '=', matrixRoomId)
      .where(sql<boolean>`${UTC_DATE} = ${utcDate}`)
      .orderBy('origin_server_ts', 'asc')
      .execute();
    return rows.map((row) => camelRow<RoomMessageHistoryDomainEntity>(row));
  }

  async getMaxOriginServerTsForRoom(matrixRoomId: string): Promise<number | null> {
    const row = await this.db
      .selectFrom('chatcoop_room_message_history')
      .select((eb) => eb.fn.max('origin_server_ts').as('m'))
      .where('matrix_room_id', '=', matrixRoomId)
      .executeTakeFirst();
    return row?.m == null || row.m === '' ? null : Number(row.m);
  }

  async existsByMatrixRoomAndEventId(matrixRoomId: string, matrixEventId: string): Promise<boolean> {
    const row = await this.db
      .selectFrom('chatcoop_room_message_history')
      .select('id')
      .where('matrix_room_id', '=', matrixRoomId)
      .where('matrix_event_id', '=', matrixEventId)
      .limit(1)
      .executeTakeFirst();
    return row != null;
  }

  /** Повторное сообщение комнаты пропускается; возвращает, вставлена ли строка. */
  async insertIgnoreDuplicate(row: RoomMessageHistoryInsertInput): Promise<boolean> {
    const inserted = await this.db
      .insertInto('chatcoop_room_message_history')
      .values({
        matrix_room_id: row.matrixRoomId,
        matrix_event_id: row.matrixEventId,
        call_transcription_id: row.callTranscriptionId,
        livekit_room_name: row.livekitRoomName,
        sender_matrix_user_id: row.senderMatrixUserId,
        sender_display_name: row.senderDisplayName,
        coop_username: row.coopUsername,
        message_kind: row.messageKind,
        body_text: row.bodyText,
        origin_server_ts: row.originServerTs,
      })
      .onConflict((conflict) => conflict.columns(['matrix_room_id', 'matrix_event_id']).doNothing())
      .returning('id')
      .execute();
    return inserted.length > 0;
  }
}
