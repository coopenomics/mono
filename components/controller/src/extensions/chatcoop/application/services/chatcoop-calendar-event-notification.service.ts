import { Inject, Injectable } from '@nestjs/common';
import type {
  InterCoopCalendarEventNotificationInput,
  InterCoopCalendarEventNotificationPort,
  InterProjectCapitalClearancePort,
} from '@coopenomics/inter';
import { INTER_PROJECT_CAPITAL_CLEARANCE } from '@coopenomics/inter';
import { Workflows } from '@coopenomics/notifications';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';
import { ACCOUNT_DATA_PORT, AccountDataPort } from '~/domain/account/ports/account-data.port';
import { NOTIFICATION_PORT, type NotificationPort } from '~/domain/notification/interfaces/notify.port';
import config from '~/config/config';
import { DateUtils } from '~/shared/utils/date-utils';
import { isEligibleForActiveCoopCalendarBroadcast } from '~/domain/account/utils/participant-mass-notification.util';

type CalendarRecipient = { username: string; email: string; subscriberId: string };

/**
 * Реализация {@link InterCoopCalendarEventNotificationPort}: по выбранным получателям.
 * Комнаты capital_project + projectHash — только с подтверждённым допуском к проекту (Capital / inter).
 * Остальные комнаты — все подходящие пайщики со статусом active в Mono (не registered без активации).
 */
@Injectable()
export class ChatcoopCalendarEventNotificationService implements InterCoopCalendarEventNotificationPort {
  private coopShortName: string | null = null;

  constructor(
    @Inject(NOTIFICATION_PORT) private readonly notificationPort: NotificationPort,
    @Inject(ACCOUNT_DATA_PORT) private readonly accountPort: AccountDataPort,
    @Inject(INTER_PROJECT_CAPITAL_CLEARANCE)
    private readonly projectCapitalClearance: InterProjectCapitalClearancePort,
    private readonly logger: WinstonLoggerService
  ) {
    this.logger.setContext(ChatcoopCalendarEventNotificationService.name);
  }

  private getTimezoneLabel(): string {
    return config.timezone === 'Europe/Moscow' ? 'Мск' : config.timezone;
  }

  private async getCoopShortName(): Promise<string> {
    if (this.coopShortName) {
      return this.coopShortName;
    }
    const account = await this.accountPort.getAccount(config.coopname);
    const shortName = account.private_account?.organization_data?.short_name;
    this.coopShortName = shortName ?? config.coopname;
    return this.coopShortName;
  }

  private formatEndParts(endsAt: Date | null): { endDate: string; endTime: string } {
    if (!endsAt) {
      return { endDate: 'не указано', endTime: 'не указано' };
    }
    return {
      endDate: DateUtils.formatLocalDate(endsAt),
      endTime: DateUtils.formatLocalTime(endsAt),
    };
  }

  /** Рассылка по кооперативу: только active в Mono + email + subscriber_id. */
  private async listRecipientsCoopWideActiveOnly(): Promise<CalendarRecipient[]> {
    const batchSize = 100;
    let currentPage = 1;
    let hasMorePages = true;
    const allAccounts: CalendarRecipient[] = [];

    while (hasMorePages) {
      const accountsPage = await this.accountPort.getAccounts(
        {},
        { page: currentPage, limit: batchSize, sortOrder: 'DESC' }
      );

      const mappings = accountsPage.items
        .filter(isEligibleForActiveCoopCalendarBroadcast)
        .map((account) => ({
          username: account.username,
          email: account.provider_account?.email?.trim() ?? '',
          subscriberId: account.provider_account?.subscriber_id?.trim() ?? '',
        }))
        .filter((m): m is CalendarRecipient => m.email.includes('@') && m.subscriberId !== '');

      allAccounts.push(...mappings);

      if (accountsPage.currentPage >= accountsPage.totalPages || accountsPage.items.length === 0) {
        hasMorePages = false;
      } else {
        currentPage++;
      }
    }

    return allAccounts;
  }

  /** Комната проекта Capital: допуск из appendix + active + email + subscriber_id. */
  private async listRecipientsForCapitalProjectRoom(projectHash: string): Promise<CalendarRecipient[]> {
    const usernames = await this.projectCapitalClearance.listUsernamesWithConfirmedProjectClearance(projectHash);
    const recipients: CalendarRecipient[] = [];
    const seen = new Set<string>();

    for (const raw of usernames) {
      const uname = raw.trim().toLowerCase();
      if (!uname || seen.has(uname)) {
        continue;
      }
      seen.add(uname);
      try {
        const account = await this.accountPort.getAccount(uname);
        if (!isEligibleForActiveCoopCalendarBroadcast(account)) {
          continue;
        }
        const email = account.provider_account?.email?.trim() ?? '';
        const subscriberId = account.provider_account?.subscriber_id?.trim() ?? '';
        if (!email.includes('@') || subscriberId === '') {
          continue;
        }
        recipients.push({
          username: account.username,
          email,
          subscriberId,
        });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(`Календарь: нет аккаунта или ошибка для ${uname} (проект ${projectHash}): ${message}`);
      }
    }

    return recipients;
  }

  private async resolveCalendarRecipients(
    input: InterCoopCalendarEventNotificationInput
  ): Promise<CalendarRecipient[]> {
    const ph = input.projectHash?.trim();
    if (input.roomKind === 'capital_project' && ph) {
      return this.listRecipientsForCapitalProjectRoom(ph);
    }
    return this.listRecipientsCoopWideActiveOnly();
  }

  private buildPayload(input: InterCoopCalendarEventNotificationInput, coopShortName: string) {
    const { endDate, endTime } = this.formatEndParts(input.endsAt);
    const trimmed = input.description?.trim();
    const base = {
      coopShortName,
      title: input.title,
      startDate: DateUtils.formatLocalDate(input.startsAt),
      startTime: DateUtils.formatLocalTime(input.startsAt),
      endDate,
      endTime,
      timezone: this.getTimezoneLabel(),
      roomLabel: input.roomDisplayLabel,
      eventUrl: input.eventUrl,
      actorUsername: input.actorUsername,
    };
    return trimmed ? { ...base, description: trimmed } : base;
  }

  private async dispatchWorkflow(
    workflowId: string,
    input: InterCoopCalendarEventNotificationInput
  ): Promise<void> {
    const users = await this.resolveCalendarRecipients(input);
    if (users.length === 0) {
      this.logger.warn(
        'Нет получателей для уведомления календаря (active Mono + email + subscriber_id; для комнаты проекта — также допуск Capital)'
      );
      return;
    }

    const coopShortName = await this.getCoopShortName();
    const payload = this.buildPayload(input, coopShortName);

    let sent = 0;
    for (const user of users) {
      try {
        await this.notificationPort.notify({
          coopname: config.coopname,
          workflowId,
          to: { subscriberId: user.subscriberId, email: user.email, username: user.username },
          payload,
        });
        sent++;
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(`Ошибка уведомления календаря для ${user.username}: ${message}`);
      }
    }

    this.logger.log(`Календарь (${workflowId}): отправлено ${sent}/${users.length}`);
  }

  async notifyEventCreated(input: InterCoopCalendarEventNotificationInput): Promise<void> {
    try {
      await this.dispatchWorkflow(Workflows.ChatCoopCalendarEventCreated.id, input);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`notifyEventCreated: ${message}`);
    }
  }

  async notifyEventUpdated(input: InterCoopCalendarEventNotificationInput): Promise<void> {
    try {
      await this.dispatchWorkflow(Workflows.ChatCoopCalendarEventUpdated.id, input);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`notifyEventUpdated: ${message}`);
    }
  }
}
