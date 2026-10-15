import { Inject, Injectable } from '@nestjs/common';
import { sql, type Kysely } from 'kysely';
import { DomainError, KYSELY, camelRow } from '@coopenomics/extension-kit';
import type { ChatCoopCalendarEventRepository } from '../../domain/repositories/calendar-event.repository';
import type {
  ChatCoopCalendarEventDomainEntity,
  CreateChatCoopCalendarEventDomainInput,
  UpdateChatCoopCalendarEventDomainInput,
} from '../../domain/entities/calendar-event.entity';
import type { DB } from '../database/chatcoop.database.types';

type CalendarEvent = ChatCoopCalendarEventDomainEntity;

/** События календаря комнат чата (таблица `chatcoop_calendar_events`). */
@Injectable()
export class CalendarEventKyselyRepository implements ChatCoopCalendarEventRepository {
  constructor(@Inject(KYSELY) private readonly db: Kysely<DB>) {}

  async create(input: CreateChatCoopCalendarEventDomainInput): Promise<CalendarEvent> {
    const row = await this.db
      .insertInto('chatcoop_calendar_events')
      .values({
        matrix_room_id: input.matrixRoomId,
        title: input.title,
        description: input.description,
        starts_at: input.startsAt,
        ends_at: input.endsAt,
        created_by_username: input.createdByUsername,
        ics_sequence: 0,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return camelRow<CalendarEvent>(row);
  }

  /** Каждая правка поднимает номер редакции события для календарей по ссылке. */
  async update(input: UpdateChatCoopCalendarEventDomainInput): Promise<CalendarEvent> {
    const row = await this.db
      .updateTable('chatcoop_calendar_events')
      .set({
        matrix_room_id: input.matrixRoomId,
        title: input.title,
        description: input.description,
        starts_at: input.startsAt,
        ends_at: input.endsAt,
        ics_sequence: sql`ics_sequence + 1`,
        updated_at: sql`now()`,
      })
      .where('id', '=', input.id)
      .returningAll()
      .executeTakeFirst();
    if (!row) throw DomainError.notFound('CHATCOOP_CALENDAR_EVENT_NOT_FOUND');
    return camelRow<CalendarEvent>(row);
  }

  /** Удаление несуществующего события — отказ, а не молчаливый успех (решение владельца 25.09.2026, C28-80). */
  async deleteById(id: string): Promise<void> {
    const rows = await this.db.deleteFrom('chatcoop_calendar_events').where('id', '=', id).returningAll().execute();
    if (rows.length === 0) throw DomainError.notFound('CHATCOOP_CALENDAR_EVENT_NOT_FOUND');
  }

  async findById(id: string): Promise<CalendarEvent | null> {
    const row = await this.db.selectFrom('chatcoop_calendar_events').selectAll().where('id', '=', id).executeTakeFirst();
    return row ? camelRow<CalendarEvent>(row) : null;
  }

  async listAll(): Promise<CalendarEvent[]> {
    const rows = await this.db.selectFrom('chatcoop_calendar_events').selectAll().orderBy('created_at', 'desc').execute();
    return rows.map((row) => camelRow<CalendarEvent>(row));
  }

  /**
   * События незашифрованных комнат проектов, по времени начала. Окно отбирает
   * события, которые его задевают: начались до конца окна и не кончились до его
   * начала (событие без конца считается идущим).
   */
  async listByManagedRoomProjectHashes(projectHashes: string[], window?: { from: Date; to: Date }): Promise<CalendarEvent[]> {
    if (projectHashes.length === 0) return [];
    let query = this.db
      .selectFrom('chatcoop_calendar_events as e')
      .innerJoin('chatcoop_managed_matrix_rooms as r', 'r.matrix_room_id', 'e.matrix_room_id')
      .selectAll('e')
      .where('r.encrypted', '=', false)
      .where('r.project_hash', 'in', projectHashes);
    if (window) {
      const { from, to } = window;
      query = query.where((eb) => eb.or([eb('e.ends_at', 'is', null), eb('e.ends_at', '>', from)])).where('e.starts_at', '<', to);
    }
    const rows = await query.orderBy('e.starts_at', 'asc').execute();
    return rows.map((row) => camelRow<CalendarEvent>(row));
  }
}
