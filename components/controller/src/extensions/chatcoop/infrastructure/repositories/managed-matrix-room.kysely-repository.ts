import { Inject, Injectable } from '@nestjs/common';
import { sql, type Kysely, type Selectable } from 'kysely';
import { KYSELY } from '@coopenomics/extension-kit';
import type {
  ChatcoopManagedMatrixRoomRepository,
  UpsertManagedMatrixRoomInput,
} from '../../domain/repositories/managed-matrix-room.repository';
import type { ManagedMatrixRoomDomainEntity, ChatcoopManagedMatrixRoomKind } from '../../domain/entities/managed-matrix-room.entity';
import type { ChatcoopManagedMatrixRooms, DB } from '../database/chatcoop.database.types';

const KINDS: readonly string[] = ['members', 'council', 'capital_project', 'secretary'];
const PROJECT_KIND: ChatcoopManagedMatrixRoomKind = 'capital_project';

function toDomain(row: Selectable<ChatcoopManagedMatrixRooms>): ManagedMatrixRoomDomainEntity {
  return {
    id: row.id,
    matrixRoomId: row.matrix_room_id,
    encrypted: row.encrypted,
    // Неизвестный вид комнаты читается как комната проекта.
    kind: (KINDS.includes(row.room_kind) ? row.room_kind : PROJECT_KIND) as ChatcoopManagedMatrixRoomKind,
    displayLabel: row.display_label,
    projectHash: row.project_hash,
    secretaryInRoom: row.secretary_in_room,
    messageHistoryPaginationToken: row.message_history_pagination_token,
    messageHistoryBackfillComplete: row.message_history_backfill_complete,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Комнаты чата, которые ведёт кооператив (таблица `chatcoop_managed_matrix_rooms`). */
@Injectable()
export class ManagedMatrixRoomKyselyRepository implements ChatcoopManagedMatrixRoomRepository {
  constructor(@Inject(KYSELY) private readonly db: Kysely<DB>) {}

  /** Признак «секретарь в комнате» при правке не трогается, если он не передан. */
  async upsertRoom(input: UpsertManagedMatrixRoomInput): Promise<ManagedMatrixRoomDomainEntity> {
    const fields = {
      encrypted: input.encrypted,
      room_kind: input.kind,
      display_label: input.displayLabel,
      project_hash: input.projectHash,
      ...(input.secretaryInRoom !== undefined ? { secretary_in_room: input.secretaryInRoom } : {}),
    };
    const row = await this.db
      .insertInto('chatcoop_managed_matrix_rooms')
      .values({ matrix_room_id: input.matrixRoomId, ...fields })
      .onConflict((conflict) => conflict.column('matrix_room_id').doUpdateSet({ ...fields, updated_at: sql`now()` }))
      .returningAll()
      .executeTakeFirstOrThrow();
    return toDomain(row);
  }

  async findById(id: string): Promise<ManagedMatrixRoomDomainEntity | null> {
    const row = await this.rooms().where('id', '=', id).executeTakeFirst();
    return row ? toDomain(row) : null;
  }

  async findByMatrixRoomId(matrixRoomId: string): Promise<ManagedMatrixRoomDomainEntity | null> {
    const row = await this.rooms().where('matrix_room_id', '=', matrixRoomId).executeTakeFirst();
    return row ? toDomain(row) : null;
  }

  async findByKind(kind: ChatcoopManagedMatrixRoomKind): Promise<ManagedMatrixRoomDomainEntity[]> {
    return (await this.rooms().where('room_kind', '=', kind).execute()).map(toDomain);
  }

  async findByProjectHash(projectHash: string): Promise<ManagedMatrixRoomDomainEntity[]> {
    const rows = await this.rooms().where('room_kind', '=', PROJECT_KIND).where('project_hash', '=', projectHash).execute();
    return rows.map(toDomain);
  }

  async findAll(): Promise<ManagedMatrixRoomDomainEntity[]> {
    return (await this.rooms().execute()).map(toDomain);
  }

  async findNonProjectCommunicationRooms(): Promise<ManagedMatrixRoomDomainEntity[]> {
    return (await this.rooms().where('room_kind', '<>', PROJECT_KIND).execute()).map(toDomain);
  }

  async findEligibleForSecretaryTranscription(): Promise<ManagedMatrixRoomDomainEntity[]> {
    return (await this.rooms().where('encrypted', '=', false).execute()).map(toDomain);
  }

  async setSecretaryInRoom(matrixRoomId: string, secretaryInRoom: boolean): Promise<void> {
    await this.db
      .updateTable('chatcoop_managed_matrix_rooms')
      .set({ secretary_in_room: secretaryInRoom, updated_at: sql`now()` })
      .where('matrix_room_id', '=', matrixRoomId)
      .execute();
  }

  async deleteByMatrixRoomId(matrixRoomId: string): Promise<void> {
    await this.db.deleteFrom('chatcoop_managed_matrix_rooms').where('matrix_room_id', '=', matrixRoomId).execute();
  }

  async updateMessageHistoryIngestState(
    matrixRoomId: string,
    patch: { paginationToken: string | null; backfillComplete: boolean }
  ): Promise<void> {
    await this.db
      .updateTable('chatcoop_managed_matrix_rooms')
      .set({
        message_history_pagination_token: patch.paginationToken,
        message_history_backfill_complete: patch.backfillComplete,
        updated_at: sql`now()`,
      })
      .where('matrix_room_id', '=', matrixRoomId)
      .execute();
  }

  private rooms() {
    return this.db.selectFrom('chatcoop_managed_matrix_rooms').selectAll();
  }
}
