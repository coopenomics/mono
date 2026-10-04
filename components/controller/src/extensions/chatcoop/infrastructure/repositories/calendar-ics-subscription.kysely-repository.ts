import { Inject, Injectable } from '@nestjs/common';
import type { Kysely } from 'kysely';
import { KYSELY, camelRow } from '@coopenomics/extension-kit';
import type {
  ChatCoopCalendarIcsSubscriptionDomainEntity,
  ChatCoopCalendarIcsSubscriptionRepository,
} from '../../domain/repositories/calendar-ics-subscription.repository';
import type { DB } from '../database/chatcoop.database.types';

type Subscription = ChatCoopCalendarIcsSubscriptionDomainEntity;

/** Подписки пайщиков на календарь по ссылке ICS (таблица `chatcoop_calendar_ics_subscriptions`). */
@Injectable()
export class CalendarIcsSubscriptionKyselyRepository implements ChatCoopCalendarIcsSubscriptionRepository {
  constructor(@Inject(KYSELY) private readonly db: Kysely<DB>) {}

  async create(coopUsername: string, secretSha256Hex: string): Promise<Subscription> {
    const row = await this.db
      .insertInto('chatcoop_calendar_ics_subscriptions')
      .values({ coop_username: coopUsername.toLowerCase(), secret_sha256_hex: secretSha256Hex })
      .returningAll()
      .executeTakeFirstOrThrow();
    return camelRow<Subscription>(row);
  }

  async findById(id: string): Promise<Subscription | null> {
    const row = await this.db.selectFrom('chatcoop_calendar_ics_subscriptions').selectAll().where('id', '=', id).executeTakeFirst();
    return row ? camelRow<Subscription>(row) : null;
  }

  async findByUsername(coopUsername: string): Promise<Subscription | null> {
    const row = await this.db
      .selectFrom('chatcoop_calendar_ics_subscriptions')
      .selectAll()
      .where('coop_username', '=', coopUsername.toLowerCase())
      .executeTakeFirst();
    return row ? camelRow<Subscription>(row) : null;
  }

  /** Новый секрет ссылки; подписки ещё нет — заводится. */
  async rotateSecretForUser(coopUsername: string, secretSha256Hex: string): Promise<Subscription> {
    const row = await this.db
      .updateTable('chatcoop_calendar_ics_subscriptions')
      .set({ secret_sha256_hex: secretSha256Hex })
      .where('coop_username', '=', coopUsername.toLowerCase())
      .returningAll()
      .executeTakeFirst();
    return row ? camelRow<Subscription>(row) : this.create(coopUsername, secretSha256Hex);
  }
}
