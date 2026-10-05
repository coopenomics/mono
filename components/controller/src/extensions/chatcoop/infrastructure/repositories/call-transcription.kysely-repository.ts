import { Inject, Injectable, Optional } from '@nestjs/common';
import { sql, type Kysely, type Selectable } from 'kysely';
import { KYSELY } from '@coopenomics/extension-kit';
import { CallTranscriptionRepository } from '../../domain/repositories/call-transcription.repository';
import { CallTranscriptionDomainEntity, TranscriptionStatus } from '../../domain/entities/call-transcription.entity';
import { ChatcoopLiveFeedService } from '../realtime/chatcoop-live-feed.service';
import type { ChatcoopCallTranscriptions, DB } from '../database/chatcoop.database.types';

type Transcription = CallTranscriptionDomainEntity;
type Row = Selectable<ChatcoopCallTranscriptions>;

function toDomain(row: Row): Transcription {
  return {
    id: row.id,
    roomId: row.room_id,
    matrixRoomId: row.matrix_room_id,
    roomName: row.room_name,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    participants: row.participants as unknown as string[],
    status: row.status as TranscriptionStatus,
    memo: row.memo ?? '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  } as Transcription;
}

/** Колонки из переданных полей транскрипции; незаданное поле пропускается. */
function toColumns(data: Partial<Transcription>): Record<string, unknown> {
  const columns: Record<string, unknown> = {
    room_id: data.roomId,
    matrix_room_id: data.matrixRoomId,
    room_name: data.roomName,
    started_at: data.startedAt,
    ended_at: data.endedAt,
    participants: data.participants === undefined ? undefined : JSON.stringify(data.participants),
    status: data.status,
    memo: data.memo,
  };
  return Object.fromEntries(Object.entries(columns).filter(([, value]) => value !== undefined));
}

/** Расшифровки звонков (таблица `chatcoop_call_transcriptions`). */
@Injectable()
export class CallTranscriptionKyselyRepository implements CallTranscriptionRepository {
  constructor(
    @Inject(KYSELY) private readonly db: Kysely<DB>,
    // Участникам звонка сигнал ленты шлётся отсюда: владельцы транскрипции —
    // имена пайщиков, а в строке хранятся идентификаторы Matrix.
    @Optional() @Inject(ChatcoopLiveFeedService) private readonly live: ChatcoopLiveFeedService | null = null
  ) {}

  async create(data: Omit<Transcription, 'id' | 'createdAt' | 'updatedAt'>): Promise<Transcription> {
    const row = await this.db
      .insertInto('chatcoop_call_transcriptions')
      .values(toColumns(data) as never)
      .returningAll()
      .executeTakeFirstOrThrow();
    void this.live?.publishTranscription(row.id);
    return toDomain(row);
  }

  async findById(id: string): Promise<Transcription | null> {
    const row = await this.all().where('id', '=', id).executeTakeFirst();
    return row ? toDomain(row) : null;
  }

  async findByRoomId(roomId: string): Promise<Transcription | null> {
    const row = await this.all().where('room_id', '=', roomId).executeTakeFirst();
    return row ? toDomain(row) : null;
  }

  async findByMatrixRoomId(matrixRoomId: string): Promise<Transcription[]> {
    const rows = await this.all().where('matrix_room_id', '=', matrixRoomId).orderBy('created_at', 'desc').execute();
    return rows.map(toDomain);
  }

  async findActiveByRoomId(roomId: string): Promise<Transcription | null> {
    const row = await this.all()
      .where('room_id', '=', roomId)
      .where('status', '=', TranscriptionStatus.ACTIVE as Row['status'])
      .executeTakeFirst();
    return row ? toDomain(row) : null;
  }

  async update(id: string, data: Partial<Transcription>): Promise<Transcription> {
    const row = await this.db
      .updateTable('chatcoop_call_transcriptions')
      .set({ ...toColumns(data), updated_at: sql`now()` })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst();
    if (!row) {
      throw new Error('Call transcription not found after update');
    }
    void this.live?.publishTranscription(id);
    return toDomain(row);
  }

  async findAll(options?: { limit?: number; offset?: number }): Promise<Transcription[]> {
    let query = this.all().orderBy('created_at', 'desc');
    if (options?.offset) query = query.offset(options.offset);
    if (options?.limit) query = query.limit(options.limit);
    return (await query.execute()).map(toDomain);
  }

  async findCompletedByMatrixRoomIdsEndedAfter(matrixRoomIds: string[], endedAfterExclusive: Date): Promise<Transcription[]> {
    if (matrixRoomIds.length === 0) return [];
    const rows = await this.completedIn(matrixRoomIds)
      .selectAll()
      .where('ended_at', '>', endedAfterExclusive)
      .orderBy('ended_at', 'asc')
      .execute();
    return rows.map(toDomain);
  }

  async getMaxCompletedEndedAtForRooms(matrixRoomIds: string[]): Promise<Date | null> {
    if (matrixRoomIds.length === 0) return null;
    const row = await this.completedIn(matrixRoomIds)
      .select((eb) => eb.fn.max('ended_at').as('m'))
      .executeTakeFirst();
    return row?.m ?? null;
  }

  /** Участник ищется по своему идентификатору чата и по строке с суффиксом сессии (`@user:server:suffix`). */
  async findByParticipant(canonicalMatrixUserId: string): Promise<Transcription[]> {
    const rows = await this.all()
      .where(
        sql<boolean>`EXISTS (
          SELECT 1 FROM jsonb_array_elements_text(participants) AS elem
          WHERE elem = ${canonicalMatrixUserId} OR elem LIKE ${`${canonicalMatrixUserId}:%`}
        )`
      )
      .orderBy('created_at', 'desc')
      .execute();
    return rows.map(toDomain);
  }

  private all() {
    return this.db.selectFrom('chatcoop_call_transcriptions').selectAll();
  }

  private completedIn(matrixRoomIds: string[]) {
    return this.db
      .selectFrom('chatcoop_call_transcriptions')
      .where('status', '=', TranscriptionStatus.COMPLETED as Row['status'])
      .where('matrix_room_id', 'in', matrixRoomIds);
  }
}
