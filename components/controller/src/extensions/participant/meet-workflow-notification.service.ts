import { Injectable, Inject, OnModuleInit } from '@nestjs/common';
import { LOGGER_PORT, type ILoggerPort, ACCOUNT_PORT, type IAccountPort, NOTIFICATION_PORT, INotificationPort, ExtendedMeetStatus, MEET_PORT, type IMeetPort,
  isEligibleForParticipantMassNotification, type InnerAccount,
} from '@coopenomics/innercoop';
import { platformSettings, DateUtils } from '@coopenomics/extension-kit';
import type { TrackedMeet } from './types';
import { Workflows } from '@coopenomics/notifications';
import { t } from './i18n';

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
    return platformSettings().timezone === 'Europe/Moscow' ? t('participant.meetWorkflowNotification.timezoneMsk') : platformSettings().timezone;
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

  /**
   * Адресаты оповещения о собрании — пайщики с email и subscriber_id (как в
   * остальной системе). На собрании уполномоченных — только председатели
   * участков собрания: остальные пайщики не голосуют, и звать их на
   * голосование незачем. Состав голосующих считает ядро (порт собрания).
   */
  private async getMeetRecipients(meet: TrackedMeet): Promise<MeetRecipient[]> {
    try {
      const voters = await this.meetPort.getMeetVoters({ coopname: meet.coopname, hash: meet.hash });
      if (voters !== null) {
        // Собрание уполномоченных: председателей единицы — аккаунты читаются по имени.
        // Аккаунт, который не прочитался, выпадает из рассылки один, а не роняет её целиком.
        const accounts = await Promise.all(
          voters.map((username) =>
            this.accountPort.getAccount(username).catch((error: any) => {
              this.logger.warn(`Председатель участка ${username} не получит оповещение о собрании ${meet.hash}: ${error.message}`);
              return null;
            })
          )
        );
        return this.toRecipients(accounts.filter((account): account is InnerAccount => account !== null));
      }

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

        allAccounts = [...allAccounts, ...this.toRecipients(accountsPage.items)];

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

  /** Пайщики, которым доступна массовая рассылка, с email и subscriber_id. */
  private toRecipients(accounts: InnerAccount[]): MeetRecipient[] {
    return accounts
      .filter(isEligibleForParticipantMassNotification)
      .map((account) => ({
        username: account.username,
        email: account.provider_account?.email?.trim() ?? '',
        subscriberId: account.provider_account?.subscriber_id?.trim() ?? '',
      }))
      .filter((m): m is MeetRecipient => m.email.includes('@') && m.subscriberId !== '');
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
    const users = await this.getMeetRecipients(meet);
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

    return this.broadcast(Workflows.MeetInitial.id, payload, meet, t('participant.meetWorkflowNotification.eventType.newMeet'));
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
      t('participant.meetWorkflowNotification.eventType.reminderBeforeStart', { timeDescription })
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

    return this.broadcast(Workflows.MeetStarted.id, payload, meet, t('participant.meetWorkflowNotification.eventType.started'));
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
      t('participant.meetWorkflowNotification.eventType.reminderBeforeEnd', { timeDescription })
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

    return this.broadcast(Workflows.MeetRestart.id, payload, meet, t('participant.meetWorkflowNotification.eventType.restartScheduled'));
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
        endTitle = t('participant.meetWorkflowNotification.noQuorumTitle', { meetId: meet.id, coopShortName });
        endMessage = t('participant.meetWorkflowNotification.noQuorumMessage', { meetId: meet.id });
        break;

      case ExtendedMeetStatus.VOTING_COMPLETED:
        endType = 'VOTING_COMPLETED';
        endTitle = t('participant.meetWorkflowNotification.votingCompletedTitle', { meetId: meet.id, coopShortName });
        endMessage = t('participant.meetWorkflowNotification.votingCompletedMessage', { meetId: meet.id });
        break;

      case ExtendedMeetStatus.CLOSED:
        endType = 'CLOSED';
        endTitle = t('participant.meetWorkflowNotification.closedTitle', { meetId: meet.id, coopShortName });
        endMessage = t('participant.meetWorkflowNotification.closedMessage', { meetId: meet.id });
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

    return this.broadcast(Workflows.MeetEnded.id, payload, meet, t('participant.meetWorkflowNotification.eventType.ended'));
  }
}
