import { Inject, Injectable } from '@nestjs/common';
import { sql, type Selectable } from 'kysely';
import type {
  NotificationOutboxCreate,
  NotificationOutboxFilter,
  NotificationOutboxRepository,
} from '~/domain/notification/repositories/notification-store.repository';
import {
  NotificationOutboxStatus,
  type NotificationOutboxDomainInterface,
} from '~/domain/notification/interfaces/notification-outbox.domain.interface';
import type { NotificationChannel } from '~/domain/notification/interfaces/notify-input.domain.interface';
import type { NotificationOutbox } from '../database.types';
import { KYSELY, type Database } from '../kysely.tokens';

function toRow(row: NotificationOutboxCreate) {
  return {
    coopname: row.coopname,
    workflowId: row.workflowId,
    channel: row.channel,
    recipientSubscriberId: row.recipientSubscriberId,
    recipientEmail: row.recipientEmail ?? null,
    recipientUsername: row.recipientUsername ?? null,
    payload: row.payload == null ? null : JSON.stringify(row.payload),
    actorSubscriberId: row.actorSubscriberId ?? null,
    idempotencyKey: row.idempotencyKey,
    status: row.status,
    attempts: row.attempts,
    maxAttempts: row.maxAttempts,
    scheduledAt: row.scheduledAt,
  };
}

function toDomain(row: Selectable<NotificationOutbox>): NotificationOutboxDomainInterface {
  return {
    id: row.id,
    coopname: row.coopname,
    workflowId: row.workflowId,
    channel: row.channel as NotificationChannel,
    recipientSubscriberId: row.recipientSubscriberId,
    recipientEmail: row.recipientEmail ?? undefined,
    recipientUsername: row.recipientUsername ?? undefined,
    payload: (row.payload as Record<string, unknown> | null) ?? undefined,
    actorSubscriberId: row.actorSubscriberId ?? undefined,
    idempotencyKey: row.idempotencyKey,
    status: row.status as NotificationOutboxStatus,
    attempts: row.attempts,
    maxAttempts: row.maxAttempts,
    scheduledAt: row.scheduledAt,
    lastError: row.lastError ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

@Injectable()
export class NotificationOutboxKyselyRepository implements NotificationOutboxRepository {
  constructor(@Inject(KYSELY) private readonly db: Database) {}

  async insertIgnoringDuplicates(rows: NotificationOutboxCreate[]): Promise<string[]> {
    if (rows.length === 0) return [];
    const inserted = await this.db
      .insertInto('notification_outbox')
      .values(rows.map(toRow))
      .onConflict((conflict) => conflict.doNothing())
      .returningAll()
      .execute();
    return inserted.map((row) => row.id);
  }

  async create(row: NotificationOutboxCreate): Promise<NotificationOutboxDomainInterface> {
    const created = await this.db.insertInto('notification_outbox').values(toRow(row)).returningAll().executeTakeFirstOrThrow();
    return toDomain(created);
  }

  async findById(id: string): Promise<NotificationOutboxDomainInterface | null> {
    const row = await this.db.selectFrom('notification_outbox').selectAll().where('id', '=', id).executeTakeFirst();
    return row ? toDomain(row) : null;
  }

  async findDue(now: Date, staleBefore: Date, limit: number): Promise<NotificationOutboxDomainInterface[]> {
    const rows = await this.db
      .selectFrom('notification_outbox')
      .selectAll()
      .where((eb) =>
        eb.or([
          eb.and([eb('status', '=', NotificationOutboxStatus.PENDING), eb('scheduledAt', '<=', now)]),
          eb.and([eb('status', '=', NotificationOutboxStatus.SENDING), eb('updatedAt', '<=', staleBefore)]),
        ])
      )
      .orderBy('scheduledAt', 'asc')
      .limit(limit)
      .execute();
    return rows.map(toDomain);
  }

  async findPage(filter: NotificationOutboxFilter, page: number, limit: number): Promise<[NotificationOutboxDomainInterface[], number]> {
    let query = this.db.selectFrom('notification_outbox').where('coopname', '=', filter.coopname);
    if (filter.workflowId) query = query.where('workflowId', '=', filter.workflowId);
    if (filter.channel) query = query.where('channel', '=', filter.channel);
    if (filter.status) query = query.where('status', '=', filter.status);
    if (filter.recipientSubscriberId) query = query.where('recipientSubscriberId', '=', filter.recipientSubscriberId);

    const rows = await query
      .selectAll()
      .orderBy('createdAt', 'desc')
      .offset((page - 1) * limit)
      .limit(limit)
      .execute();
    const total = await query.select((eb) => eb.fn.countAll<string>().as('count')).executeTakeFirstOrThrow();
    return [rows.map(toDomain), Number(total.count)];
  }

  async saveProgress(row: NotificationOutboxDomainInterface): Promise<void> {
    await this.db
      .updateTable('notification_outbox')
      .set({
        status: row.status,
        attempts: row.attempts,
        scheduledAt: row.scheduledAt,
        lastError: row.lastError ?? null,
        // По этой дате находится отправка, зависшая после сбоя узла.
        updatedAt: sql`now()`,
      })
      .where('id', '=', row.id)
      .execute();
  }
}
