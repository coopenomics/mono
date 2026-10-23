import { Inject, Injectable } from '@nestjs/common';
import { LOGGER_PORT, type ILoggerPort, ACCOUNT_PORT, type IAccountPort, type InnerAccount, MEET_PORT, IMeetPort, ExtendedMeetStatus,
  isEligibleForParticipantMassNotification,
} from '@coopenomics/innercoop';
import { IConfig, TrackedMeet, defaultConfig } from './types';
import { MeetWorkflowNotificationService } from './meet-workflow-notification.service';
import { EXTENSION_REPOSITORY, ExtensionDomainRepository, ExtensionDomainEntity, platformSettings, DateUtils } from '@coopenomics/extension-kit';

@Injectable()
export class MeetTrackerService {
  constructor(
    @Inject(LOGGER_PORT) private readonly logger: ILoggerPort,
    @Inject(EXTENSION_REPOSITORY) private readonly extensionRepository: ExtensionDomainRepository<IConfig>,
    @Inject(MEET_PORT) private readonly meetPort: IMeetPort,
    @Inject(ACCOUNT_PORT) private readonly accountPort: IAccountPort,
    private readonly workflowNotificationService: MeetWorkflowNotificationService
  ) {
    this.logger.setContext(MeetTrackerService.name);
  }

  // Сервисное имя и конфигурация
  private readonly extensionName = 'participant';
  private extensionConfig!: ExtensionDomainEntity<IConfig>;

  private ensureConfigDefaults(): void {
    if (!this.extensionConfig?.config) {
      this.extensionConfig = {
        ...this.extensionConfig,
        config: { ...defaultConfig },
      };
    }

    const config = this.extensionConfig.config;

    config.trackedMeets = Array.isArray(config.trackedMeets) ? config.trackedMeets : [];
    config.closedMeetIds = Array.isArray(config.closedMeetIds) ? config.closedMeetIds : [];

    if (typeof config.minutesBeforeStartNotification !== 'number') {
      config.minutesBeforeStartNotification = defaultConfig.minutesBeforeStartNotification;
    }
    if (typeof config.minutesBeforeEndNotification !== 'number') {
      config.minutesBeforeEndNotification = defaultConfig.minutesBeforeEndNotification;
    }
    if (typeof config.checkIntervalMinutes !== 'number') {
      config.checkIntervalMinutes = defaultConfig.checkIntervalMinutes;
    }
    if (typeof config.lastCheckTimestamp !== 'string') {
      config.lastCheckTimestamp = defaultConfig.lastCheckTimestamp;
    }
  }

  // Инициализация сервиса
  async initialize(extensionConfig: ExtensionDomainEntity<IConfig>): Promise<void> {
    this.extensionConfig = extensionConfig;
    this.logger.info('MeetTrackerService инициализирован');
  }

  /**
   * Сохраняет состояние трекинга собраний read-modify-write по СВЕЖЕМУ config.
   *
   * `this.extensionConfig` — снимок, захваченный при initialize() (boot), а
   * cron-проверка крутится часами; update() заменяет весь config JSONB целиком.
   * Если писать захваченный снимок, затрутся поля, записанные в БД после boot
   * другими сервисами (онбординг-флаги и т.п.) — это и есть наблюдавшийся
   * сброс онбординга. Поэтому берём актуальный config из БД и накладываем
   * только поля, которыми владеет meet-tracker.
   */
  private async persistTrackedState(): Promise<void> {
    const fresh = await this.extensionRepository.findByName(this.extensionName);
    const baseConfig = fresh?.config ?? this.extensionConfig.config;
    const nextConfig: IConfig = {
      ...baseConfig,
      trackedMeets: this.extensionConfig.config.trackedMeets,
      closedMeetIds: this.extensionConfig.config.closedMeetIds,
      lastCheckTimestamp: this.extensionConfig.config.lastCheckTimestamp,
    };
    await this.extensionRepository.update({ name: this.extensionName, config: nextConfig });
    this.extensionConfig = { ...this.extensionConfig, config: nextConfig };
  }

  // Приватная функция для обновления trackedMeet на основе свежих данных
  private getUpdatedTrackedMeet(trackedMeet: TrackedMeet, meetData: any, extendedStatus: string): TrackedMeet {
    return {
      ...trackedMeet,
      status: meetData.status,
      extendedStatus: extendedStatus,
      open_at: meetData.open_at.toISOString(),
      close_at: meetData.close_at.toISOString(),
    };
  }

  // Основная функция проверки собраний
  async checkMeets(): Promise<void> {
    try {
      // Подтягиваем актуальный конфиг из базы
      const repo = await this.extensionRepository.findByName(this.extensionName);
      if (repo) {
        this.extensionConfig = repo;
      }

      if (!this.extensionConfig) {
        this.logger.error('Конфигурация MeetTrackerService не инициализирована');
        return;
      }

      this.ensureConfigDefaults();

      // Получаем все собрания из блокчейна через порт
      const meets = await this.meetPort.getMeets({ coopname: platformSettings().coopname }, undefined);
      if (!meets || meets.length === 0) {
        this.logger.debug('Собрания не найдены');
        return;
      }

      // Текущие дата и время
      const now = new Date();

      // Инициализация closedMeetIds, если его нет
      const closedMeetIds = this.extensionConfig.config.closedMeetIds;

      // Создаем словарь всех отслеживаемых собраний по ID для отслеживания рестартов
      const meetsByID = new Map<number, { current: TrackedMeet | null; previous: TrackedMeet | null }>();
      for (const trackedMeet of this.extensionConfig.config.trackedMeets) {
        meetsByID.set(trackedMeet.id, {
          current: trackedMeet,
          previous: null,
        });
      }

      for (const meet of meets) {
        const meetProcessing = meet.processing;
        if (!meetProcessing) continue;

        const meetHash = meetProcessing.hash;
        const meetData = meetProcessing.meet;
        const meetID = meetData.id;
        const extendedStatus = meetProcessing.extendedStatus;

        // Пропускаем обработку, если собрание уже закрыто и уведомление отправлено
        if (closedMeetIds.includes(meetID)) {
          continue;
        }

        const existingMeet = meetsByID.get(meetID) || { current: null, previous: null };
        if (existingMeet.current && existingMeet.current.hash !== meetHash) {
          existingMeet.previous = existingMeet.current;
          existingMeet.current = null;
        }
        const trackedMeetIndex = this.extensionConfig.config.trackedMeets.findIndex((tm) => tm.hash === meetHash);
        const isTracked = trackedMeetIndex !== -1;

        // Если собрание в статусе CLOSED, обрабатываем его и удаляем из списка отслеживаемых
        if (extendedStatus === ExtendedMeetStatus.CLOSED && isTracked) {
          let trackedMeet = this.extensionConfig.config.trackedMeets[trackedMeetIndex];
          trackedMeet = this.getUpdatedTrackedMeet(trackedMeet, meetData, extendedStatus);

          if (!this.extensionConfig.config.trackedMeets[trackedMeetIndex].notifications.endNotification) {
            const delivered = await this.workflowNotificationService.sendEndNotification(trackedMeet);
            this.extensionConfig.config.trackedMeets[trackedMeetIndex].notifications.endNotification = delivered;
            if (!closedMeetIds.includes(meetID)) {
              closedMeetIds.push(meetID);
              await this.persistTrackedState();
            }
          }
          this.logger.info(`Удаление закрытого собрания ${meetHash} (№${meetID}) из списка отслеживаемых`);
          this.extensionConfig.config.trackedMeets.splice(trackedMeetIndex, 1);
          if (existingMeet.current === trackedMeet) {
            existingMeet.current = null;
          }
          continue;
        }

        // Если собрание в статусе EXPIRED_NO_QUORUM или VOTING_COMPLETED, отправляем уведомление о завершении
        if (
          (extendedStatus === ExtendedMeetStatus.EXPIRED_NO_QUORUM ||
            extendedStatus === ExtendedMeetStatus.VOTING_COMPLETED) &&
          isTracked
        ) {
          let trackedMeet = this.extensionConfig.config.trackedMeets[trackedMeetIndex];
          trackedMeet = this.getUpdatedTrackedMeet(trackedMeet, meetData, extendedStatus);
          if (!this.extensionConfig.config.trackedMeets[trackedMeetIndex].notifications.endNotification) {
            const delivered = await this.workflowNotificationService.sendEndNotification(trackedMeet);
            this.extensionConfig.config.trackedMeets[trackedMeetIndex].notifications.endNotification = delivered;
          }
          continue;
        }

        // Если собрание новое (не отслеживается), добавляем его в список отслеживаемых
        if (!isTracked) {
          // Не добавляем, если id уже в closedMeetIds
          if (closedMeetIds.includes(meetID)) {
            continue;
          }
          // Удаляем все старые собрания с тем же id перед добавлением нового
          this.extensionConfig.config.trackedMeets = this.extensionConfig.config.trackedMeets.filter((tm) => tm.id !== meetID);
          // Создаем новое отслеживаемое собрание
          const newTrackedMeet: TrackedMeet = {
            id: meetID,
            hash: meetHash,
            coopname: meetData.coopname,
            open_at: meetData.open_at.toISOString(),
            close_at: meetData.close_at.toISOString(),
            status: meetData.status,
            extendedStatus: extendedStatus,
            notifications: {
              initialNotification: false,
              threeDaysBeforeStart: false,
              startNotification: false,
              oneDayBeforeEnd: false,
              restartNotification: false,
              endNotification: false,
            },
          };

          // Проверяем, является ли это рестартом существующего собрания
          const isRestart = existingMeet.previous !== null;

          // Добавляем в список отслеживаемых и обновляем словарь
          this.extensionConfig.config.trackedMeets.push(newTrackedMeet);
          existingMeet.current = newTrackedMeet;
          meetsByID.set(meetID, existingMeet);

          // Обрабатываем собрание в зависимости от статуса и от того, является ли оно рестартом
          if (extendedStatus === ExtendedMeetStatus.WAITING_FOR_OPENING) {
            if (isRestart) {
              // Это рестарт собрания, отправляем уведомление о новой дате
              this.logger.info(`Обнаружен рестарт собрания №${meetID}, новый hash: ${meetHash}`);
              newTrackedMeet.notifications.restartNotification =
                await this.workflowNotificationService.sendRestartNotification(newTrackedMeet);
            } else {
              // Это новое собрание, отправляем начальное уведомление ТОЛЬКО если оно сразу в WAITING_FOR_OPENING
              this.logger.info(`Обнаружено новое собрание: ${meetHash} (№${meetID}) со статусом WAITING_FOR_OPENING`);
              newTrackedMeet.notifications.initialNotification =
                await this.workflowNotificationService.sendInitialNotification(newTrackedMeet);
            }
          } else if (extendedStatus === ExtendedMeetStatus.VOTING_IN_PROGRESS) {
            // Собрание уже началось, отправляем уведомление о начале
            this.logger.info(`Обнаружено активное собрание: ${meetHash} (№${meetID}) со статусом VOTING_IN_PROGRESS`);
            newTrackedMeet.notifications.startNotification =
              await this.workflowNotificationService.sendStartNotification(newTrackedMeet);
          }
          // Для собраний в статусе CREATED не отправляем уведомления

          continue;
        }

        // Обновляем существующее собрание
        const trackedMeet = this.extensionConfig.config.trackedMeets[trackedMeetIndex];

        // Обновляем данные собрания
        const oldStatus = trackedMeet.extendedStatus;
        trackedMeet.status = meetData.status;
        trackedMeet.extendedStatus = extendedStatus;

        trackedMeet.open_at = meetData.open_at.toISOString();
        trackedMeet.close_at = meetData.close_at.toISOString();
        // Проверяем изменение статуса
        const statusChanged = oldStatus !== extendedStatus;

        // Обрабатываем переходы состояний
        if (statusChanged) {
          this.logger.info(`Изменение статуса собрания ${meetHash} (№${meetID}): ${oldStatus} -> ${extendedStatus}`);

          if (
            oldStatus === ExtendedMeetStatus.ONRESTART &&
            extendedStatus === ExtendedMeetStatus.WAITING_FOR_OPENING &&
            !trackedMeet.notifications.restartNotification
          ) {
            trackedMeet.notifications.restartNotification =
              await this.workflowNotificationService.sendRestartNotification(trackedMeet);
          }

          // При переходе с created на waitingForOpening отправляем начальное уведомление
          if (
            oldStatus === ExtendedMeetStatus.CREATED &&
            extendedStatus === ExtendedMeetStatus.WAITING_FOR_OPENING &&
            !trackedMeet.notifications.initialNotification
          ) {
            trackedMeet.notifications.initialNotification =
              await this.workflowNotificationService.sendInitialNotification(trackedMeet);
          }

          // При переходе в VOTING_IN_PROGRESS отправляем уведомление о начале собрания
          if (extendedStatus === ExtendedMeetStatus.VOTING_IN_PROGRESS && !trackedMeet.notifications.startNotification) {
            trackedMeet.notifications.startNotification =
              await this.workflowNotificationService.sendStartNotification(trackedMeet);
          }
        }

        // Используем DateUtils для корректной работы с датами
        const openAt = DateUtils.convertUtcToLocalTime(trackedMeet.open_at);
        const closeAt = DateUtils.convertUtcToLocalTime(trackedMeet.close_at);

        // Проверяем, нужно ли отправить уведомление за указанное время до начала
        if (!trackedMeet.notifications.threeDaysBeforeStart && extendedStatus === ExtendedMeetStatus.WAITING_FOR_OPENING) {
          // Вычисляем время, за которое нужно отправить уведомление
          const minutesBeforeStart = this.extensionConfig.config.minutesBeforeStartNotification;
          const msBeforeStart = minutesBeforeStart * 60 * 1000;
          const notificationTime = new Date(openAt.getTime() - msBeforeStart);

          // Проверяем, наступило ли время отправки уведомления
          if (now >= notificationTime) {
            trackedMeet.notifications.threeDaysBeforeStart =
              await this.workflowNotificationService.sendThreeDaysBeforeStartNotification(trackedMeet);
          }
        }

        // Проверяем, нужно ли отправить уведомление за указанное время до завершения
        if (!trackedMeet.notifications.oneDayBeforeEnd && extendedStatus === ExtendedMeetStatus.VOTING_IN_PROGRESS) {
          // Вычисляем время, за которое нужно отправить уведомление
          const minutesBeforeEnd = this.extensionConfig.config.minutesBeforeEndNotification;
          const msBeforeEnd = minutesBeforeEnd * 60 * 1000;
          const notificationTime = new Date(closeAt.getTime() - msBeforeEnd);

          // Проверяем, наступило ли время отправки уведомления
          if (now >= notificationTime) {
            trackedMeet.notifications.oneDayBeforeEnd =
              await this.workflowNotificationService.sendOneDayBeforeEndNotification(trackedMeet);
          }
        }
      }

      // Обновляем время последней проверки
      this.extensionConfig.config.lastCheckTimestamp = now.toISOString();

      // Сохраняем изменения в конфигурации
      await this.persistTrackedState();
    } catch (error: any) {
      this.logger.error(`Ошибка при проверке собраний: ${error.message}`, error.stack);
    }
  }

  // Получение всех аккаунтов с использованием пакетной загрузки
  async getAllAccounts(): Promise<InnerAccount[]> {
    try {
      const batchSize = 100;
      let currentPage = 1;
      let hasMorePages = true;
      let allAccounts: InnerAccount[] = [];

      this.logger.debug(`Начало загрузки аккаунтов с размером пакета: ${batchSize}`);

      while (hasMorePages) {
        const accountsPage = await this.accountPort.getAccounts(
          {},
          {
            page: currentPage,
            limit: batchSize,
            sortOrder: 'DESC',
          }
        );

        const eligible = accountsPage.items.filter(isEligibleForParticipantMassNotification);
        allAccounts = [...allAccounts, ...eligible];

        if (accountsPage.currentPage >= accountsPage.totalPages || accountsPage.items.length === 0) {
          hasMorePages = false;
          this.logger.debug(`Загрузка аккаунтов завершена. Всего загружено: ${allAccounts.length}`);
        } else {
          currentPage++;
          this.logger.debug(`Загружена страница ${currentPage - 1}/${accountsPage.totalPages}, продолжаем загрузку...`);
        }
      }

      return allAccounts;
    } catch (error: any) {
      this.logger.error(`Ошибка при получении аккаунтов: ${error.message}`, error.stack);
      return [];
    }
  }

  // Получение всех email-адресов пользователей
  async getAllUserEmails(): Promise<string[]> {
    try {
      // Получаем аккаунты с использованием пакетной загрузки
      const accounts = await this.getAllAccounts();

      // Извлекаем email из аккаунтов
      const emails = accounts
        .map((account) => account.provider_account?.email)
        .filter((email) => email && email.includes('@')) as string[];

      return emails;
    } catch (error: any) {
      this.logger.error(`Ошибка при получении email пользователей: ${error.message}`, error.stack);
      return [];
    }
  }
}
