import { Inject, Injectable } from '@nestjs/common';
import type { NotificationDeliveryRepository } from '~/domain/notification/repositories/notification-store.repository';
import type {
  NotificationDeliveryDomainInterface,
  NotificationDeliveryStatus,
} from '~/domain/notification/interfaces/notification-outbox.domain.interface';
import type { NotificationChannel } from '~/domain/notification/interfaces/notify-input.domain.interface';
import { KYSELY, type Database } from '../kysely.tokens';

@Injectable()
export class NotificationDeliveryKyselyRepository implements NotificationDeliveryRepository {
  constructor(@Inject(KYSELY) private readonly db: Database) {}

  async append(row: Omit<NotificationDeliveryDomainInterface, 'id' | 'createdAt'>): Promise<void> {
    await this.db
      .insertInto('notification_deliveries')
      .values({
        outboxId: row.outboxId,
        coopname: row.coopname,
        channel: row.channel,
        recipientSubscriberId: row.recipientSubscriberId,
        workflowId: row.workflowId,
        attemptNumber: row.attemptNumber,
        status: row.status,
        providerResponse: row.providerResponse ?? null,
        error: row.error ?? null,
      })
      .execute();
  }

  async findByOutboxId(outboxId: string): Promise<NotificationDeliveryDomainInterface[]> {
    const rows = await this.db
      .selectFrom('notification_deliveries')
      .selectAll()
      .where('outboxId', '=', outboxId)
      .orderBy('createdAt', 'asc')
      .execute();
    return rows.map((row) => ({
      id: row.id,
      outboxId: row.outboxId,
      coopname: row.coopname,
      channel: row.channel as NotificationChannel,
      recipientSubscriberId: row.recipientSubscriberId,
      workflowId: row.workflowId,
      attemptNumber: row.attemptNumber,
      status: row.status as NotificationDeliveryStatus,
      providerResponse: row.providerResponse ?? undefined,
      error: row.error ?? undefined,
      createdAt: row.createdAt,
    }));
  }
}
