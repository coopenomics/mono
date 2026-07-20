import { Injectable, Inject, OnModuleInit } from '@nestjs/common';
import { MEET_REPOSITORY, MeetPreProcessingRepository } from '~/domain/meet/repositories/meet-pre.repository';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';
import { NOTIFICATION_PORT, type NotificationPort } from '~/domain/notification/interfaces/notify.port';
import config from '~/config/config';
import { DateUtils } from '~/shared/utils/date-utils';
import { ExtendedMeetStatus } from '~/domain/meet/enums/extended-meet-status.enum';
import type { TrackedMeet } from './types';
import { ACCOUNT_DATA_PORT, AccountDataPort } from '~/domain/account/ports/account-data.port';
import { Workflows } from '@coopenomics/notifications';
import { isEligibleForParticipantMassNotification } from '~/domain/account/utils/participant-mass-notification.util';

type MeetRecipient = { username: string; email: string; subscriberId: string };

/**
 * Сервис для отправки уведомлений о собраниях через workflow
 */
@Injectable()
export class MeetWorkflowNotificationService implements OnModuleInit {
  constructor(
    @Inject(NOTIFICATION_PORT)
    private readonly notificationPort: NotificationPort,
    @Inject(ACCOUNT_DATA_PORT)
    private readonly accountPort: AccountDataPort,
    @Inject(MEET_REPOSITORY)
    private readonly meetPreRepository: MeetPreProcessingRepository,
    private readonly logger: WinstonLoggerService
  ) {
    this.logger.setContext(MeetWorkflowNotificationService.name);
  }

  // Кэшированное краткое название кооператива
  private coopShortName: string | null = null;

  async onModuleInit() {
    this.logger.log('MeetWorkflowNotificationService инициализирован');
  }

  // Получение краткого названия кооператива
  private async getCoopShortName(): Promise<string> {
    if (this.coopShortName) {
      return this.coopShortName;
    }

    const account = await this.accountPort.getAccount(config.coopname);

    const shortName = account.private_account?.organization_data?.short_name;

    this.coopShortName = shortName ?? '';
    return this.coopShortName;
  }

  // Формирование URL для уведомлений
  private getNotificationUrl(meet: TrackedMeet): string {
    return `${config.frontend_url}/${meet.coopname}/user/meets/${meet.hash.toUpperCase()}`;
  }

  // Форматирование сообщения о часовом поясе
  private getTimezoneDisplay(): string {
    return config.timezone === 'Europe/Moscow' ? 'МСК' : config.timezone;
  }

  /**
   * Текст из meet_pre только для workflow «до/у начала»: meet-initial, meet-reminder-start, meet-started.
   * В reminder-end, restart, ended поле details в схемах каталога нет — не передаём, иначе ошибка валидации.
   */
  private async meetDetailsPayloadPart(hash: string): Promise<{ details?: string }> {
    const pre = await this.meetPreRepository.findByHash(hash);
    const trimmed = pre?.details?.trim();
    return trimmed ? { details: trimmed } : {};
  }

  /** Пайщики с email и subscriber_id (как в остальной системе). */
  private async getMeetRecipients(): Promise<MeetRecipient[]> {
    try {
      const batchSize = 100;
      let currentPage = 1;
      let hasMorePages = true;
      let allAccounts: MeetRecipient[] = [];

      while (hasMorePages) {
        const accountsPage = await this.accountPort.getAccounts(
          {},
          {
            page: currentPage,
            limit: batchSize,
            sortOrder: 'DESC',
          }
        );

        const mappings = accountsPage.items
          .filter(isEligibleForParticipantMassNotification)
          .map((account) => ({
            username: account.username,
            email: account.provider_account?.email?.trim() ?? '',
            subscriberId: account.provider_account?.subscriber_id?.trim() ?? '',
          }))
          .filter((m): m is MeetRecipient => m.email.includes('@') && m.subscriberId !== '');

        allAccounts = [...allAccounts, ...mappings];

        if (accountsPage.currentPage >= accountsPage.totalPages || accountsPage.items.length === 0) {
          hasMorePages = false;
        } else {
          currentPage++;
        }
      }

      return allAccounts;
    } catch (error: any) {
      this.logger.error(`Ошибка при получении получателей для собраний: ${error.message}`, error.stack);
      return [];
    }
  }

  // 1. Начальное уведомление при появлении собрания в статусе WAITING_FOR_OPENING
  async sendInitialNotification(meet: TrackedMeet): Promise<void> {
    const users = await this.getMeetRecipients();
    if (users.length === 0) return;

    const coopShortName = await this.getCoopShortName();
    const meetDate = DateUtils.formatLocalDate(meet.open_at);
    const meetTime = DateUtils.formatLocalTime(meet.open_at);
    const meetEndDate = DateUtils.formatLocalDate(meet.close_at);
    const meetEndTime = DateUtils.formatLocalTime(meet.close_at);
    const timezone = this.getTimezoneDisplay();
    const meetUrl = this.getNotificationUrl(meet);

    const detailsPart = await this.meetDetailsPayloadPart(meet.hash);
    const payload: Workflows.MeetInitial.IPayload = {
      coopShortName,
      meetId: meet.id,
      meetDate,
      meetTime,
      meetEndDate,
      meetEndTime,
      timezone,
      meetUrl,
      ...detailsPart,
    };

    // Отправляем уведомления каждому пользователю в цикле
    let sentCount = 0;
    for (const user of users) {
      try {
        await this.notificationPort.notify({
          coopname: meet.coopname,
          workflowId: Workflows.MeetInitial.id,
          to: {
            subscriberId: user.subscriberId,
            email: user.email,
            username: user.username,
          },
          payload,
        });
        sentCount++;
      } catch (error: any) {
        this.logger.error(`Ошибка отправки начального уведомления пользователю ${user.username}: ${error.message}`);
      }
    }

    this.logger.info(
      `Отправлено начальное уведомление о собрании ${meet.hash} (№${meet.id}) для ${sentCount}/${users.length} пользователей`
    );
  }

  // 2. Уведомление за N минут до начала собрания
  async sendThreeDaysBeforeStartNotification(meet: TrackedMeet): Promise<void> {
    const users = await this.getMeetRecipients();
    if (users.length === 0) return;

    const coopShortName = await this.getCoopShortName();
    const meetDate = DateUtils.formatLocalDate(meet.open_at);
    const meetTime = DateUtils.formatLocalTime(meet.open_at);

    // Рассчитываем реальную разницу между текущим временем и временем начала собрания
    const now = new Date();
    const openAtDate = DateUtils.convertUtcToLocalTime(meet.open_at);
    const diffMinutes = Math.floor((openAtDate.getTime() - now.getTime()) / (1000 * 60));
    const timeDescription = DateUtils.formatDurationHumanizeRu(diffMinutes);

    const meetUrl = this.getNotificationUrl(meet);

    const detailsPart = await this.meetDetailsPayloadPart(meet.hash);
    const payload: Workflows.MeetReminderStart.IPayload = {
      coopShortName,
      meetId: meet.id,
      meetDate,
      meetTime,
      timeDescription,
      meetUrl,
      ...detailsPart,
    };

    // Отправляем уведомления каждому пользователю в цикле
    let sentCount = 0;
    for (const user of users) {
      try {
        await this.notificationPort.notify({
          coopname: meet.coopname,
          workflowId: Workflows.MeetReminderStart.id,
          to: {
            subscriberId: user.subscriberId,
            email: user.email,
            username: user.username,
          },
          payload,
        });
        sentCount++;
      } catch (error: any) {
        this.logger.error(`Ошибка отправки уведомления о начале собрания пользователю ${user.username}: ${error.message}`);
      }
    }

    this.logger.info(
      `Отправлено уведомление за ${timeDescription} до начала собрания ${meet.hash} (№${meet.id}) для ${sentCount}/${users.length} пользователей`
    );
  }

  // 3. Уведомление о начале собрания (при переходе в статус VOTING_IN_PROGRESS)
  async sendStartNotification(meet: TrackedMeet): Promise<void> {
    const users = await this.getMeetRecipients();
    if (users.length === 0) return;

    const coopShortName = await this.getCoopShortName();
    const meetEndDate = DateUtils.formatLocalDate(meet.close_at);
    const meetEndTime = DateUtils.formatLocalTime(meet.close_at);
    const timezone = this.getTimezoneDisplay();
    const meetUrl = this.getNotificationUrl(meet);

    const detailsPart = await this.meetDetailsPayloadPart(meet.hash);
    const payload: Workflows.MeetStarted.IPayload = {
      coopShortName,
      meetId: meet.id,
      meetEndDate,
      meetEndTime,
      timezone,
      meetUrl,
      ...detailsPart,
    };

    // Отправляем уведомления каждому пользователю в цикле
    let sentCount = 0;
    for (const user of users) {
      try {
        await this.notificationPort.notify({
          coopname: meet.coopname,
          workflowId: Workflows.MeetStarted.id,
          to: {
            subscriberId: user.subscriberId,
            email: user.email,
            username: user.username,
          },
          payload,
        });
        sentCount++;
      } catch (error: any) {
        this.logger.error(`Ошибка отправки уведомления о старте собрания пользователю ${user.username}: ${error.message}`);
      }
    }

    this.logger.info(
      `Отправлено уведомление о начале собрания ${meet.hash} (№${meet.id}) для ${sentCount}/${users.length} пользователей`
    );
  }

  // 4. Уведомление за N минут до окончания собрания
  async sendOneDayBeforeEndNotification(meet: TrackedMeet): Promise<void> {
    const users = await this.getMeetRecipients();
    if (users.length === 0) return;

    const coopShortName = await this.getCoopShortName();
    const meetEndDate = DateUtils.formatLocalDate(meet.close_at);
    const meetEndTime = DateUtils.formatLocalTime(meet.close_at);

    // Рассчитываем реальную разницу между текущим временем и временем окончания собрания
    const now = new Date();
    const closeAtDate = DateUtils.convertUtcToLocalTime(meet.close_at);
    const diffMinutes = Math.floor((closeAtDate.getTime() - now.getTime()) / (1000 * 60));
    const timeDescription = DateUtils.formatDurationHumanizeRu(diffMinutes);

    const timezone = this.getTimezoneDisplay();
    const meetUrl = this.getNotificationUrl(meet);

    const payload: Workflows.MeetReminderEnd.IPayload = {
      coopShortName,
      meetId: meet.id,
      meetEndDate,
      meetEndTime,
      timeDescription,
      timezone,
      meetUrl,
    };

    // Отправляем уведомления каждому пользователю в цикле
    let sentCount = 0;
    for (const user of users) {
      try {
        await this.notificationPort.notify({
          coopname: meet.coopname,
          workflowId: Workflows.MeetReminderEnd.id,
          to: {
            subscriberId: user.subscriberId,
            email: user.email,
            username: user.username,
          },
          payload,
        });
        sentCount++;
      } catch (error: any) {
        this.logger.error(
          `Ошибка отправки уведомления об окончании собрания пользователю ${user.username}: ${error.message}`
        );
      }
    }

    this.logger.info(
      `Отправлено уведомление за ${timeDescription} до завершения собрания ${meet.hash} (№${meet.id}) для ${sentCount}/${users.length} пользователей`
    );
  }

  // 5. Уведомление о назначении новой даты для повторного собрания
  async sendRestartNotification(meet: TrackedMeet): Promise<void> {
    const users = await this.getMeetRecipients();
    if (users.length === 0) return;

    const coopShortName = await this.getCoopShortName();
    const meetDate = DateUtils.formatLocalDate(meet.open_at);
    const meetTime = DateUtils.formatLocalTime(meet.open_at);
    const meetEndDate = DateUtils.formatLocalDate(meet.close_at);
    const meetEndTime = DateUtils.formatLocalTime(meet.close_at);
    const timezone = this.getTimezoneDisplay();
    const meetUrl = this.getNotificationUrl(meet);

    const payload: Workflows.MeetRestart.IPayload = {
      coopShortName,
      meetId: meet.id,
      meetDate,
      meetTime,
      meetEndDate,
      meetEndTime,
      timezone,
      meetUrl,
    };

    // Отправляем уведомления каждому пользователю в цикле
    let sentCount = 0;
    for (const user of users) {
      try {
        await this.notificationPort.notify({
          coopname: meet.coopname,
          workflowId: Workflows.MeetRestart.id,
          to: {
            subscriberId: user.subscriberId,
            email: user.email,
            username: user.username,
          },
          payload,
        });
        sentCount++;
      } catch (error: any) {
        this.logger.error(
          `Ошибка отправки уведомления о повторном собрании пользователю ${user.username}: ${error.message}`
        );
      }
    }

    this.logger.info(
      `Отправлено уведомление о новой дате повторного собрания ${meet.hash} (№${meet.id}) для ${sentCount}/${users.length} пользователей`
    );
  }

  // 6. Уведомление о разных вариантах завершения собрания
  async sendEndNotification(meet: TrackedMeet): Promise<void> {
    const users = await this.getMeetRecipients();
    if (users.length === 0) return;

    const coopShortName = await this.getCoopShortName();
    const meetUrl = this.getNotificationUrl(meet);

    let endTitle = '';
    let endMessage = '';
    let endType: 'EXPIRED_NO_QUORUM' | 'VOTING_COMPLETED' | 'CLOSED' = 'CLOSED';

    switch (meet.extendedStatus) {
      case ExtendedMeetStatus.EXPIRED_NO_QUORUM:
        endType = 'EXPIRED_NO_QUORUM';
        endTitle = `Кворум общего собрания №${meet.id} в ${coopShortName} не собран`;
        endMessage = `Кворум общего собрания №${meet.id} не собран. В ближайшее время будет назначена новая дата собрания с прежней повесткой. Следите за обновлениями.`;
        break;

      case ExtendedMeetStatus.VOTING_COMPLETED:
        endType = 'VOTING_COMPLETED';
        endTitle = `Голосование по собранию №${meet.id} в ${coopShortName} завершено`;
        endMessage = `Голосование по собранию №${meet.id} завершено. Ожидаем утверждения протокола собрания советом.`;
        break;

      case ExtendedMeetStatus.CLOSED:
        endType = 'CLOSED';
        endTitle = `Общее собрание №${meet.id} в ${coopShortName} завершено`;
        endMessage = `Общее собрание пайщиков №${meet.id} успешно завершено. Протокол собрания утвержден.`;
        break;
    }

    if (!endTitle || !endMessage) {
      this.logger.warn(`Неподдерживаемый статус для отправки уведомления о завершении: ${meet.extendedStatus}`);
      return;
    }

    const payload: Workflows.MeetEnded.IPayload = {
      coopShortName,
      meetId: meet.id,
      meetUrl,
      endType,
      endTitle,
      endMessage,
    };

    // Отправляем уведомления каждому пользователю в цикле
    let sentCount = 0;
    for (const user of users) {
      try {
        await this.notificationPort.notify({
          coopname: meet.coopname,
          workflowId: Workflows.MeetEnded.id,
          to: {
            subscriberId: user.subscriberId,
            email: user.email,
            username: user.username,
          },
          payload,
        });
        sentCount++;
      } catch (error: any) {
        this.logger.error(
          `Ошибка отправки уведомления о завершении собрания пользователю ${user.username}: ${error.message}`
        );
      }
    }

    this.logger.info(
      `Отправлено уведомление о завершении собрания ${meet.hash} (№${meet.id}) для ${sentCount}/${users.length} пользователей`
    );
  }
}
