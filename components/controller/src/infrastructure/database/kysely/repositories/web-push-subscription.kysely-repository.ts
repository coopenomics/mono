import { Inject, Injectable } from '@nestjs/common';
import { sql, type Selectable } from 'kysely';
import { DomainError } from '@coopenomics/extension-kit';
import type { NotificationPort } from '~/domain/notification/interfaces/web-push-subscription.port';
import type { WebPushSubscriptionDomainInterface } from '~/domain/notification/interfaces/web-push-subscription-domain.interface';
import type { CreateWebPushSubscriptionDomainInterface } from '~/domain/notification/interfaces/create-web-push-subscription-domain.interface';
import type { SubscriptionStatsDomainInterface } from '~/domain/notification/interfaces/subscription-stats-domain.interface';
import { WebPushSubscriptionDomainEntity } from '~/domain/notification/entities/web-push-subscription-domain.entity';
import type { WebPushSubscriptions } from '../database.types';
import { KYSELY, type Database } from '../kysely.tokens';

function toDomain(row: Selectable<WebPushSubscriptions>): WebPushSubscriptionDomainInterface {
  return new WebPushSubscriptionDomainEntity({
    id: row.id,
    username: row.username,
    endpoint: row.endpoint,
    p256dhKey: row.p256dhKey,
    authKey: row.authKey,
    userAgent: row.userAgent ?? undefined,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

/** Подписки браузеров на push-уведомления (таблица `web_push_subscriptions`). */
@Injectable()
export class WebPushSubscriptionKyselyRepository implements NotificationPort {
  constructor(@Inject(KYSELY) private readonly db: Database) {}

  async saveSubscription(data: CreateWebPushSubscriptionDomainInterface): Promise<WebPushSubscriptionDomainInterface> {
    const row = await this.db
      .insertInto('web_push_subscriptions')
      .values({
        username: data.username,
        endpoint: data.endpoint,
        p256dhKey: data.p256dhKey,
        authKey: data.authKey,
        userAgent: data.userAgent ?? null,
        isActive: true,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return toDomain(row);
  }

  async findByEndpoint(endpoint: string): Promise<WebPushSubscriptionDomainInterface | null> {
    const row = await this.db.selectFrom('web_push_subscriptions').selectAll().where('endpoint', '=', endpoint).executeTakeFirst();
    return row ? toDomain(row) : null;
  }

  async getUserSubscriptions(username: string): Promise<WebPushSubscriptionDomainInterface[]> {
    const rows = await this.db
      .selectFrom('web_push_subscriptions')
      .selectAll()
      .where('username', '=', username)
      .where('isActive', '=', true)
      .execute();
    return rows.map(toDomain);
  }

  async getAllActiveSubscriptions(): Promise<WebPushSubscriptionDomainInterface[]> {
    const rows = await this.db.selectFrom('web_push_subscriptions').selectAll().where('isActive', '=', true).execute();
    return rows.map(toDomain);
  }

  async deactivateSubscription(endpoint: string): Promise<void> {
    await this.db
      .updateTable('web_push_subscriptions')
      .set({ isActive: false, updatedAt: sql`now()` })
      .where('endpoint', '=', endpoint)
      .execute();
  }

  async deactivateSubscriptionById(id: string): Promise<void> {
    await this.db
      .updateTable('web_push_subscriptions')
      .set({ isActive: false, updatedAt: sql`now()` })
      .where('id', '=', id)
      .execute();
  }

  async cleanupInactiveSubscriptions(olderThanDays: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
    const result = await this.db
      .deleteFrom('web_push_subscriptions')
      .where('isActive', '=', false)
      .where('updatedAt', '<', cutoffDate)
      .executeTakeFirst();
    return Number(result.numDeletedRows ?? 0);
  }

  async getSubscriptionStats(): Promise<SubscriptionStatsDomainInterface> {
    const stats = await this.db
      .selectFrom('web_push_subscriptions')
      .select((eb) => [
        eb.fn.countAll<string>().as('total'),
        eb.fn.countAll<string>().filterWhere('isActive', '=', true).as('active'),
        eb.fn.count<string>('username').distinct().filterWhere('isActive', '=', true).as('uniqueUsers'),
      ])
      .executeTakeFirstOrThrow();
    const total = Number(stats.total);
    const active = Number(stats.active);
    return { total, active, inactive: total - active, uniqueUsers: Number(stats.uniqueUsers) };
  }

  async updateSubscription(
    endpoint: string,
    data: Partial<CreateWebPushSubscriptionDomainInterface>
  ): Promise<WebPushSubscriptionDomainInterface> {
    // Обновляются только переданные поля; подписка при обновлении снова активна.
    const row = await this.db
      .updateTable('web_push_subscriptions')
      .set({
        ...(data.username !== undefined ? { username: data.username } : {}),
        ...(data.p256dhKey !== undefined ? { p256dhKey: data.p256dhKey } : {}),
        ...(data.authKey !== undefined ? { authKey: data.authKey } : {}),
        ...(data.userAgent !== undefined ? { userAgent: data.userAgent } : {}),
        isActive: true,
        updatedAt: sql`now()`,
      })
      .where('endpoint', '=', endpoint)
      .returningAll()
      .executeTakeFirst();
    if (!row) {
      throw DomainError.notFound('DATABASE_WEB_PUSH_SUBSCRIPTION_NOT_FOUND');
    }
    return toDomain(row);
  }
}
