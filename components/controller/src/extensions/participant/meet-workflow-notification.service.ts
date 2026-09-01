import { Injectable, Inject, OnModuleInit } from '@nestjs/common';
import { LOGGER_PORT, type ILoggerPort, ACCOUNT_PORT, type IAccountPort, NOTIFICATION_PORT, INotificationPort, ExtendedMeetStatus, MEET_PORT, type IMeetPort,
  isEligibleForParticipantMassNotification,
} from '@coopenomics/innercoop';
import { platformSettings, DateUtils } from '@coopenomics/extension-kit';
import type { TrackedMeet } from './types';
import { Workflows } from '@coopenomics/notifications';

type MeetRecipient = { username: string; email: string; subscriberId: string };

/**
 * Сервис для отправки уведомлений о собраниях через workflow
 */
@Injectable()
export class MeetWorkflowNotificationService implements OnModuleInit {
  constructor(
    @Inject(NOTIFICATION_PORT)
    private readonly notificationPort: INotificationPort,
    @Inject(ACCOUNT_PORT)
    private readonly accountPort: IAccountPort,
    @Inject(MEET_PORT)
    private readonly meetPort: IMeetPort,
    @Inject(LOGGER_PORT) private readonly logger: ILoggerPort
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

    const account = await this.accountPort.getAccount(platformSettings().coopname);

    const shortName: string | undefined = account.private_account?.organization_data?.short_name;

    const resolved = shortName ?? '';
    this.coopShortName = resolved;
    return resolved;
  }

  // Формирование URL для уведомлений
  private getNotificationUrl(meet: TrackedMeet): string {
    return `${platformSettings().frontendUrl}/${meet.coopname}/user/meets/${meet.hash.toUpperCase()}`;
  }

  // Форматирование сообщения о часовом поясе
  private getTimezoneDisplay(): string {
    return platformSettings().timezone === 'Europe/Moscow' ? 'МСК' : platformSettings().timezone;
  }

  /**
   * Текст из meet_pre только для workflow «до/у начала»: meet-initial, meet-reminder-start, meet-started.
   * В reminder-end, restart, ended поле details в схемах каталога нет — не передаём, иначе ошибка валидации.
   */
  private async meetDetailsPayloadPart(hash: string): Promise<{ details?: string }> {
    const pre = await this.meetPort.getMeetDraft(hash);
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

  /**
   * Рассылает уведомление пайщикам и сообщает, ушло ли оно хоть кому-то.
   *
   * Возврат важен: трекер по нему помечает уведомление отправленным и больше к нему
   * не возвращается. Раньше методы возвращали `void` и молча выходили на пустом
   * списке получателей, а флаг всё равно выставлялся — сбой выборки в момент
   * назначения даты навсегда съедал рассылку по этому собранию, не оставляя следа
   * в журнале (инцидент 2026-08-27).
   */
  private async broadcast(
    workflowId: string,
    payload: Record<string, unknown>,
    meet: TrackedMeet,
    description: string
  ): Promise<boolean> {
    const users = await this.getMeetRecipients();
    if (users.length === 0) {
      this.logger.warn(
        `Рассылка «${description}» по собранию ${meet.hash} (№${meet.id}) не выполнена: получателей не найдено`
      );
      return false;
    }

    let sentCount = 0;
    for (const user of users) {
      try {
        await this.notificationPort.notify({
          coopname: meet.coopname,
          workflowId,
          to: {
            subscriberId: user.subscriberId,
            email: user.email,
            username: user.username,
          },
          payload,
        });
        sentCount++;
      } catch (error: any) {
        this.logger.error(`Ошибка отправки «${description}» пользователю ${user.username}: ${error.message}`);
      }
    }

    if (sentCount === 0) {
      this.logger.warn(
        `Рассылка «${description}» по собранию ${meet.hash} (№${meet.id}) не дошла ни до одного из ${users.length} пайщиков`
      );
      return false;
    }

    this.logger.info(
      `Рассылка «${description}» по собранию ${meet.hash} (№${meet.id}): ${sentCount}/${users.length} пайщиков`
    );
    return true;
  }

  // 1. Начальное уведомление при появлении собрания в статусе WAITING_FOR_OPENING
  async sendInitialNotification(meet: TrackedMeet): Promise<boolean> {
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

    return this.broadcast(Workflows.MeetInitial.id, payload, meet, 'новое общее собрание');
  }

  // 2. Уведомление за N минут до начала собрания
  async sendThreeDaysBeforeStartNotification(meet: TrackedMeet): Promise<boolean> {
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

    return this.broadcast(
      Workflows.MeetReminderStart.id,
      payload,
      meet,
      `напоминание за ${timeDescription} до начала`
    );
  }

  // 3. Уведомление о начале собрания (при переходе в статус VOTING_IN_PROGRESS)
  async sendStartNotification(meet: TrackedMeet): Promise<boolean> {
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

    return this.broadcast(Workflows.MeetStarted.id, payload, meet, 'собрание началось');
  }

  // 4. Уведомление за N минут до окончания собрания
  async sendOneDayBeforeEndNotification(meet: TrackedMeet): Promise<boolean> {
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

    return this.broadcast(
      Workflows.MeetReminderEnd.id,
      payload,
      meet,
      `напоминание за ${timeDescription} до завершения`
    );
  }

  // 5. Уведомление о назначении новой даты для повторного собрания
  async sendRestartNotification(meet: TrackedMeet): Promise<boolean> {
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

    return this.broadcast(Workflows.MeetRestart.id, payload, meet, 'назначена новая дата повторного собрания');
  }

  // 6. Уведомление о разных вариантах завершения собрания
  async sendEndNotification(meet: TrackedMeet): Promise<boolean> {
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
      return false;
    }

    const payload: Workflows.MeetEnded.IPayload = {
      coopShortName,
      meetId: meet.id,
      meetUrl,
      endType,
      endTitle,
      endMessage,
    };

    return this.broadcast(Workflows.MeetEnded.id, payload, meet, 'собрание завершено');
  }
}
