import { Inject, Injectable } from '@nestjs/common';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';
import { DateUtils } from '~/shared/utils/date-utils';
import { default as config } from '~/config/config';
import { TrackedMeet, NotificationTypes, ILog } from './types';
import {
  LOG_EXTENSION_REPOSITORY,
  LogExtensionDomainRepository,
} from '~/domain/extension/repositories/log-extension-domain.repository';
import { ExtendedMeetStatus } from '~/domain/meet/enums/extended-meet-status.enum';
import { ACCOUNT_DATA_PORT, AccountDataPort } from '~/domain/account/ports/account-data.port';
import { NOTIFICATION_PORT, type NotificationPort } from '~/domain/notification/interfaces/notify.port';
import { Workflows } from '@coopenomics/notifications';

@Injectable()
export class NotificationSenderService {
  constructor(
    private readonly logger: WinstonLoggerService,
    @Inject(LOG_EXTENSION_REPOSITORY) private readonly logExtensionRepository: LogExtensionDomainRepository<ILog>,
    @Inject(ACCOUNT_DATA_PORT) private readonly accountPort: AccountDataPort,
    @Inject(NOTIFICATION_PORT) private readonly notificationPort: NotificationPort
  ) {
    this.logger.setContext(NotificationSenderService.name);
  }

  // Сервисное имя для логирования
  private readonly extensionName = 'participant';

  // Кэшированное краткое название кооператива
  private coopShortName: string | null = null;

  //TODO: разобраться с этим и упростить - чет тут усложнено все
  // Функция для получения адресов - будет заменена на реальную в ParticipantPlugin
  private _getUserEmailsFunction: (() => Promise<Array<{ email: string; subscriberId: string }>>) | null = null;

  // Установка функции для получения email адресов и subscriberId
  setGetUserEmailsFunction(func: () => Promise<Array<{ email: string; subscriberId: string }>>): void {
    this._getUserEmailsFunction = func;
  }

  // Получение всех email-адресов и subscriberId пользователей через функцию
  private async getAllUserEmails(): Promise<Array<{ email: string; subscriberId: string }>> {
    if (!this._getUserEmailsFunction) {
      this.logger.warn('Функция получения email адресов не установлена');
      return [];
    }
    try {
      return await this._getUserEmailsFunction();
    } catch (error: any) {
      this.logger.error(`Ошибка при получении email пользователей: ${error.message}`, error.stack);
      return [];
    }
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

  // Логирование отправки уведомлений
  private async logNotification(meetHash: string, notificationType: string, recipients: number) {
    await this.logExtensionRepository.push(this.extensionName, {
      type: 'notification',
      meetHash,
      notificationType,
      recipients,
      timestamp: new Date().toISOString(),
    });
  }

  // Формирование URL для уведомлений
  private getNotificationUrl(meet: TrackedMeet): string {
    return `${config.frontend_url}/${meet.coopname}/user/meets/${meet.hash.toUpperCase()}`;
  }

  // Форматирование сообщения о часовом поясе
  private getTimezoneDisplay(): string {
    return config.timezone === 'Europe/Moscow' ? 'МСК' : config.timezone;
  }

  // Функции отправки уведомлений

  // 1. Начальное уведомление при появлении собрания в статусе WAITING_FOR_OPENING
  async sendInitialNotification(meet: TrackedMeet): Promise<void> {
    const users = await this.getAllUserEmails();
    if (users.length === 0) return;

    const coopShortName = await this.getCoopShortName();
    const meetDate = DateUtils.formatLocalDate(meet.open_at);
    const meetTime = DateUtils.formatLocalTime(meet.open_at);
    const meetEndDate = DateUtils.formatLocalDate(meet.close_at);
    const meetEndTime = DateUtils.formatLocalTime(meet.close_at);
    const timezone = this.getTimezoneDisplay();
    const notificationUrl = this.getNotificationUrl(meet);

    const payload: Workflows.MeetInitial.IPayload = {
      coopShortName,
      meetId: meet.id,
      meetDate,
      meetTime,
      meetEndDate,
      meetEndTime,
      timezone,
      meetUrl: notificationUrl,
    };

    // Отправляем каждому пользователю индивидуально с небольшой паузой
    for (let i = 0; i < users.length; i++) {
      const user = users[i];

      await this.notificationPort.notify({
        coopname: meet.coopname,
        workflowId: Workflows.MeetInitial.id,
        to: {
          subscriberId: user.subscriberId,
          email: user.email,
        },
        payload,
      });

      // Небольшая пауза между отправками, чтобы не спамить (100ms)
      if (i < users.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    this.logger.info(
      `Отправлено начальное уведомление о собрании ${meet.hash} (№${meet.id}) для ${users.length} пользователей`
    );
    await this.logNotification(meet.hash, NotificationTypes.INITIAL, users.length);
  }

  // 2. Уведомление за N дней до начала собрания
  async sendThreeDaysBeforeStartNotification(meet: TrackedMeet): Promise<void> {
    const users = await this.getAllUserEmails();
    if (users.length === 0) return;

    const coopShortName = await this.getCoopShortName();
    const meetDate = DateUtils.formatLocalDate(meet.open_at);
    const meetTime = DateUtils.formatLocalTime(meet.open_at);

    // Рассчитываем реальную разницу между текущим временем и временем начала собрания с учетом часового пояса
    const now = new Date();
    const openAtDate = DateUtils.convertUtcToLocalTime(meet.open_at);
    const diffMinutes = Math.floor((openAtDate.getTime() - now.getTime()) / (1000 * 60));
    const timeDescription = DateUtils.formatDurationHumanizeRu(diffMinutes);
    const notificationUrl = this.getNotificationUrl(meet);

    const payload: Workflows.MeetReminderStart.IPayload = {
      coopShortName,
      meetId: meet.id,
      meetDate,
      meetTime,
      timeDescription,
      meetUrl: notificationUrl,
    };

    // Отправляем каждому пользователю индивидуально с небольшой паузой
    for (let i = 0; i < users.length; i++) {
      const user = users[i];

      await this.notificationPort.notify({
        coopname: meet.coopname,
        workflowId: Workflows.MeetReminderStart.id,
        to: {
          subscriberId: user.subscriberId,
          email: user.email,
        },
        payload,
      });

      // Небольшая пауза между отправками, чтобы не спамить (100ms)
      if (i < users.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    this.logger.info(
      `Отправлено уведомление за ${timeDescription} до начала собрания ${meet.hash} (№${meet.id}) для ${users.length} пользователей`
    );
    await this.logNotification(meet.hash, NotificationTypes.THREE_DAYS_BEFORE_START, users.length);
  }

  // 3. Уведомление о начале собрания (при переходе в статус VOTING_IN_PROGRESS)
  async sendStartNotification(meet: TrackedMeet): Promise<void> {
    const users = await this.getAllUserEmails();
    if (users.length === 0) return;

    const coopShortName = await this.getCoopShortName();
    const meetEndDate = DateUtils.formatLocalDate(meet.close_at);
    const meetEndTime = DateUtils.formatLocalTime(meet.close_at);
    const timezone = this.getTimezoneDisplay();
    const notificationUrl = this.getNotificationUrl(meet);

    const payload: Workflows.MeetStarted.IPayload = {
      coopShortName,
      meetId: meet.id,
      meetEndDate,
      meetEndTime,
      timezone,
      meetUrl: notificationUrl,
    };

    // Отправляем каждому пользователю индивидуально с небольшой паузой
    for (let i = 0; i < users.length; i++) {
      const user = users[i];

      await this.notificationPort.notify({
        coopname: meet.coopname,
        workflowId: Workflows.MeetStarted.id,
        to: {
          subscriberId: user.subscriberId,
          email: user.email,
        },
        payload,
      });

      // Небольшая пауза между отправками, чтобы не спамить (100ms)
      if (i < users.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    this.logger.info(
      `Отправлено уведомление о начале собрания ${meet.hash} (№${meet.id}) для ${users.length} пользователей`
    );
    await this.logNotification(meet.hash, NotificationTypes.START, users.length);
  }

  // 4. Уведомление за N дней до окончания собрания
  async sendOneDayBeforeEndNotification(meet: TrackedMeet): Promise<void> {
    const users = await this.getAllUserEmails();
    if (users.length === 0) return;

    const coopShortName = await this.getCoopShortName();
    const meetEndDate = DateUtils.formatLocalDate(meet.close_at);
    const meetEndTime = DateUtils.formatLocalTime(meet.close_at);

    // Рассчитываем реальную разницу между текущим временем и временем окончания собрания с учетом часового пояса
    const now = new Date();
    const closeAtDate = DateUtils.convertUtcToLocalTime(meet.close_at);
    const diffMinutes = Math.floor((closeAtDate.getTime() - now.getTime()) / (1000 * 60));
    const timeDescription = DateUtils.formatDurationHumanizeRu(diffMinutes);
    const timezone = this.getTimezoneDisplay();
    const notificationUrl = this.getNotificationUrl(meet);

    const payload: Workflows.MeetReminderEnd.IPayload = {
      coopShortName,
      meetId: meet.id,
      meetEndDate,
      meetEndTime,
      timeDescription,
      timezone,
      meetUrl: notificationUrl,
    };

    // Отправляем каждому пользователю индивидуально с небольшой паузой
    for (let i = 0; i < users.length; i++) {
      const user = users[i];

      await this.notificationPort.notify({
        coopname: meet.coopname,
        workflowId: Workflows.MeetReminderEnd.id,
        to: {
          subscriberId: user.subscriberId,
          email: user.email,
        },
        payload,
      });

      // Небольшая пауза между отправками, чтобы не спамить (100ms)
      if (i < users.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    this.logger.info(
      `Отправлено уведомление за ${timeDescription} до завершения собрания ${meet.hash} (№${meet.id}) для ${users.length} пользователей`
    );
    await this.logNotification(meet.hash, NotificationTypes.ONE_DAY_BEFORE_END, users.length);
  }

  // 5. Уведомление о назначении новой даты для повторного собрания
  async sendRestartNotification(meet: TrackedMeet): Promise<void> {
    const users = await this.getAllUserEmails();
    if (users.length === 0) return;

    const coopShortName = await this.getCoopShortName();
    const meetDate = DateUtils.formatLocalDate(meet.open_at);
    const meetTime = DateUtils.formatLocalTime(meet.open_at);
    const meetEndDate = DateUtils.formatLocalDate(meet.close_at);
    const meetEndTime = DateUtils.formatLocalTime(meet.close_at);
    const timezone = this.getTimezoneDisplay();
    const notificationUrl = this.getNotificationUrl(meet);

    const payload: Workflows.MeetRestart.IPayload = {
      coopShortName,
      meetId: meet.id,
      meetDate,
      meetTime,
      meetEndDate,
      meetEndTime,
      timezone,
      meetUrl: notificationUrl,
    };

    // Отправляем каждому пользователю индивидуально с небольшой паузой
    for (let i = 0; i < users.length; i++) {
      const user = users[i];

      await this.notificationPort.notify({
        coopname: meet.coopname,
        workflowId: Workflows.MeetRestart.id,
        to: {
          subscriberId: user.subscriberId,
          email: user.email,
        },
        payload,
      });

      // Небольшая пауза между отправками, чтобы не спамить (100ms)
      if (i < users.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    this.logger.info(
      `Отправлено уведомление о новой дате повторного собрания ${meet.hash} (№${meet.id}) для ${users.length} пользователей`
    );
    await this.logNotification(meet.hash, NotificationTypes.RESTART, users.length);
  }

  // 6. Уведомление о разных вариантах завершения собрания
  async sendEndNotification(meet: TrackedMeet): Promise<void> {
    const users = await this.getAllUserEmails();
    if (users.length === 0) return;

    const coopShortName = await this.getCoopShortName();
    const notificationUrl = this.getNotificationUrl(meet);

    let endType: 'EXPIRED_NO_QUORUM' | 'VOTING_COMPLETED' | 'CLOSED';
    let endTitle = '';
    let endMessage = '';

    switch (meet.extendedStatus) {
      case ExtendedMeetStatus.EXPIRED_NO_QUORUM:
        endType = 'EXPIRED_NO_QUORUM';
        endTitle = `Кворум общего собрания №${meet.id} в ${coopShortName} не собран`;
        endMessage = `Уважаемый пайщик!\n\nКворум общего собрания №${meet.id} не собран. В ближайшее время будет назначена новая дата собрания с прежней повесткой.\n\nСледите за обновлениями.\n\nС уважением, Совет ${coopShortName}.`;
        break;

      case ExtendedMeetStatus.VOTING_COMPLETED:
        endType = 'VOTING_COMPLETED';
        endTitle = `Голосование по собранию №${meet.id} в ${coopShortName} завершено`;
        endMessage = `Уважаемый пайщик!\n\nГолосование по собранию №${meet.id} завершено. Ожидаем утверждения протокола собрания советом.\n\nДля просмотра результатов голосования перейдите по ссылке:\n${notificationUrl}\n\nС уважением, Совет ${coopShortName}.`;
        break;

      case ExtendedMeetStatus.CLOSED:
        endType = 'CLOSED';
        endTitle = `Общее собрание №${meet.id} в ${coopShortName} завершено`;
        endMessage = `Уважаемый пайщик!\n\nОбщее собрание пайщиков №${meet.id} успешно завершено. Протокол собрания утвержден.\n\nДля просмотра результатов собрания перейдите по ссылке:\n${notificationUrl}\n\nС уважением, Совет ${coopShortName}.`;
        break;

      default:
        this.logger.warn(`Неподдерживаемый статус для отправки уведомления о завершении: ${meet.extendedStatus}`);
        return;
    }

    const payload: Workflows.MeetEnded.IPayload = {
      coopShortName,
      meetId: meet.id,
      meetUrl: notificationUrl,
      endType,
      endTitle,
      endMessage,
    };

    // Отправляем каждому пользователю индивидуально с небольшой паузой
    for (let i = 0; i < users.length; i++) {
      const user = users[i];

      await this.notificationPort.notify({
        coopname: meet.coopname,
        workflowId: Workflows.MeetEnded.id,
        to: {
          subscriberId: user.subscriberId,
          email: user.email,
        },
        payload,
      });

      // Небольшая пауза между отправками, чтобы не спамить (100ms)
      if (i < users.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    this.logger.info(
      `Отправлено уведомление о завершении собрания ${meet.hash} (№${meet.id}) для ${users.length} пользователей`
    );
    await this.logNotification(meet.hash, NotificationTypes.END, users.length);
  }
}
