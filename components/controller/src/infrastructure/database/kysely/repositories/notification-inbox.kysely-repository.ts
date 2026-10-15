import { Inject, Injectable } from '@nestjs/common';
import type { Selectable } from 'kysely';
import type { NotificationInboxRepository } from '~/domain/notification/repositories/notification-store.repository';
import type { NotificationInboxDomainInterface } from '~/domain/notification/interfaces/notification-inbox.domain.interface';
import type { NotificationInbox } from '../database.types';
import { KYSELY, type Database } from '../kysely.tokens';

function toDomain(row: Selectable<NotificationInbox>): NotificationInboxDomainInterface {
  return {
    id: row.id,
    coopname: row.coopname,
    outboxId: row.outboxId,
    recipientSubscriberId: row.recipientSubscriberId,
    recipientUsername: row.recipientUsername ?? undefined,
    workflowId: row.workflowId,
    title: row.title,
    body: row.body,
    payload: (row.payload as Record<string, unknown> | null) ?? undefined,
    actorSubscriberId: row.actorSubscriberId ?? undefined,
    isRead: row.isRead,
    readAt: row.readAt ?? undefined,
    createdAt: row.createdAt,
  };
}

@Injectable()
export class NotificationInboxKyselyRepository implements NotificationInboxRepository {
  constructor(@Inject(KYSELY) private readonly db: Database) {}

  async create(
    row: Omit<NotificationInboxDomainInterface, 'id' | 'createdAt' | 'isRead' | 'readAt'>
  ): Promise<NotificationInboxDomainInterface> {
    const created = await this.db
      .insertInto('notification_inbox')
      .values({
        coopname: row.coopname,
        outboxId: row.outboxId,
        recipientSubscriberId: row.recipientSubscriberId,
        recipientUsername: row.recipientUsername ?? null,
        workflowId: row.workflowId,
        title: row.title,
        body: row.body,
        payload: row.payload == null ? null : JSON.stringify(row.payload),
        actorSubscriberId: row.actorSubscriberId ?? null,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return toDomain(created);
  }

  async findPage(coopname: string, subscriberId: string, page: number, limit: number): Promise<[NotificationInboxDomainInterface[], number]> {
    const query = this.db
      .selectFrom('notification_inbox')
      .where('coopname', '=', coopname)
      .where('recipientSubscriberId', '=', subscriberId);
    const rows = await query
      .selectAll()
      .orderBy('createdAt', 'desc')
      .offset((page - 1) * limit)
      .limit(limit)
      .execute();
    const total = await query.select((eb) => eb.fn.countAll<string>().as('count')).executeTakeFirstOrThrow();
    return [rows.map(toDomain), Number(total.count)];
  }

  async countUnread(coopname: string, subscriberId: string): Promise<number> {
    const total = await this.db
      .selectFrom('notification_inbox')
      .where('coopname', '=', coopname)
      .where('recipientSubscriberId', '=', subscriberId)
      .where('isRead', '=', false)
      .select((eb) => eb.fn.countAll<string>().as('count'))
      .executeTakeFirstOrThrow();
    return Number(total.count);
  }

  async findOwn(id: string, subscriberId: string): Promise<NotificationInboxDomainInterface | null> {
    const row = await this.db
      .selectFrom('notification_inbox')
      .selectAll()
      .where('id', '=', id)
      .where('recipientSubscriberId', '=', subscriberId)
      .executeTakeFirst();
    return row ? toDomain(row) : null;
  }

  async markRead(id: string, readAt: Date): Promise<void> {
    await this.db.updateTable('notification_inbox').set({ isRead: true, readAt }).where('id', '=', id).execute();
  }

  async markAllRead(coopname: string, subscriberId: string, readAt: Date): Promise<number> {
    const rows = await this.db
      .updateTable('notification_inbox')
      .set({ isRead: true, readAt })
      .where('coopname', '=', coopname)
      .where('recipientSubscriberId', '=', subscriberId)
      .where('isRead', '=', false)
      // Строка целиком: по ней лента изменений находит владельца сигнала.
      .returningAll()
      .execute();
    return rows.length;
  }
}
