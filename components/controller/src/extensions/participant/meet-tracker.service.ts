import { Inject, Injectable } from '@nestjs/common';
import { WinstonLoggerService } from '~/modules/logger/logger-app.service';
import { DateUtils } from '~/shared/utils/date-utils';
import { ExtendedMeetStatus } from '~/domain/meet/enums/extended-meet-status.enum';
import { ACCOUNT_EXTENSION_PORT, AccountExtensionPort } from '~/domain/extension/ports/account-extension-port';
import { MEET_EXTENSION_PORT, MeetExtensionPort } from '~/domain/extension/ports/meet-extension-port';
import { IConfig, TrackedMeet } from './types';
import { NotificationSenderService } from './notification-sender.service';
import {
  EXTENSION_REPOSITORY,
  ExtensionDomainRepository,
} from '~/domain/extension/repositories/extension-domain.repository';
import { ExtensionDomainEntity } from '~/domain/extension/entities/extension-domain.entity';
import { AccountDomainEntity } from '~/domain/account/entities/account-domain.entity';
import { default as config } from '~/config/config';

@Injectable()
export class MeetTrackerService {
  constructor(
    private readonly logger: WinstonLoggerService,
    @Inject(EXTENSION_REPOSITORY) private readonly extensionRepository: ExtensionDomainRepository<IConfig>,
    @Inject(MEET_EXTENSION_PORT) private readonly meetPort: MeetExtensionPort,
    @Inject(ACCOUNT_EXTENSION_PORT) private readonly accountPort: AccountExtensionPort,
    private readonly notificationSender: NotificationSenderService
  ) {
    this.logger.setContext(MeetTrackerService.name);
  }

  // Сервисное имя и конфигурация
  private readonly extensionName = 'participant';
  private pluginConfig!: ExtensionDomainEntity<IConfig>;

  // Инициализация сервиса
  async initialize(pluginConfig: ExtensionDomainEntity<IConfig>): Promise<void> {
    this.pluginConfig = pluginConfig;
    this.logger.info('MeetTrackerService инициализирован');
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
      // Получаем все собрания из блокчейна через порт
      const meets = await this.meetPort.getMeets({ coopname: config.coopname }, undefined);
      if (!meets || meets.length === 0) {
        this.logger.info('Собрания не найдены');
        return;
      }

      // Текущие дата и время
      const now = new Date();

      // Инициализация closedMeetIds, если его нет
      if (!Array.isArray(this.pluginConfig.config.closedMeetIds)) {
        this.pluginConfig.config.closedMeetIds = [];
      }
      const closedMeetIds = this.pluginConfig.config.closedMeetIds;

      // Создаем словарь всех отслеживаемых собраний по ID для отслеживания рестартов
      const meetsByID = new Map<number, { current: TrackedMeet | null; previous: TrackedMeet | null }>();
      for (const trackedMeet of this.pluginConfig.config.trackedMeets) {
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
        const trackedMeetIndex = this.pluginConfig.config.trackedMeets.findIndex((tm) => tm.hash === meetHash);
        const isTracked = trackedMeetIndex !== -1;

        // Если собрание в статусе CLOSED, обрабатываем его и удаляем из списка отслеживаемых
        if (extendedStatus === ExtendedMeetStatus.CLOSED && isTracked) {
          let trackedMeet = this.pluginConfig.config.trackedMeets[trackedMeetIndex];
          trackedMeet = this.getUpdatedTrackedMeet(trackedMeet, meetData, extendedStatus);

          if (!this.pluginConfig.config.trackedMeets[trackedMeetIndex].notifications.endNotification) {
            await this.notificationSender.sendEndNotification(trackedMeet);
            this.pluginConfig.config.trackedMeets[trackedMeetIndex].notifications.endNotification = true;
            if (!closedMeetIds.includes(meetID)) {
              closedMeetIds.push(meetID);
              await this.extensionRepository.update(this.pluginConfig);
            }
          }
          this.logger.info(`Удаление закрытого собрания ${meetHash} (№${meetID}) из списка отслеживаемых`);
          this.pluginConfig.config.trackedMeets.splice(trackedMeetIndex, 1);
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
          let trackedMeet = this.pluginConfig.config.trackedMeets[trackedMeetIndex];
          trackedMeet = this.getUpdatedTrackedMeet(trackedMeet, meetData, extendedStatus);
          if (!this.pluginConfig.config.trackedMeets[trackedMeetIndex].notifications.endNotification) {
            await this.notificationSender.sendEndNotification(trackedMeet);
            this.pluginConfig.config.trackedMeets[trackedMeetIndex].notifications.endNotification = true;
          }
          continue;
        }

        // Если собрание новое (не отслеживается), добавляем его в список отслеживаемых
        if (!isTracked) {
          // Не добавляем, если id уже в closedMeetIds
          if (closedMeetIds.includes(meetID)) {
            continue;
          }
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
          this.pluginConfig.config.trackedMeets.push(newTrackedMeet);
          existingMeet.current = newTrackedMeet;
          meetsByID.set(meetID, existingMeet);

          // Обрабатываем собрание в зависимости от статуса и от того, является ли оно рестартом
          if (extendedStatus === ExtendedMeetStatus.WAITING_FOR_OPENING) {
            if (isRestart) {
              // Это рестарт собрания, отправляем уведомление о новой дате
              this.logger.info(`Обнаружен рестарт собрания №${meetID}, новый hash: ${meetHash}`);
              await this.notificationSender.sendRestartNotification(newTrackedMeet);
              newTrackedMeet.notifications.restartNotification = true;
            } else {
              // Это новое собрание, отправляем начальное уведомление ТОЛЬКО если оно сразу в WAITING_FOR_OPENING
              this.logger.info(`Обнаружено новое собрание: ${meetHash} (№${meetID}) со статусом WAITING_FOR_OPENING`);
              await this.notificationSender.sendInitialNotification(newTrackedMeet);
              newTrackedMeet.notifications.initialNotification = true;
            }
          } else if (extendedStatus === ExtendedMeetStatus.VOTING_IN_PROGRESS) {
            // Собрание уже началось, отправляем уведомление о начале
            this.logger.info(`Обнаружено активное собрание: ${meetHash} (№${meetID}) со статусом VOTING_IN_PROGRESS`);
            await this.notificationSender.sendStartNotification(newTrackedMeet);
            newTrackedMeet.notifications.startNotification = true;
          }
          // Для собраний в статусе CREATED не отправляем уведомления

          continue;
        }

        // Обновляем существующее собрание
        const trackedMeet = this.pluginConfig.config.trackedMeets[trackedMeetIndex];

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
            await this.notificationSender.sendRestartNotification(trackedMeet);
            trackedMeet.notifications.restartNotification = true;
          }

          // При переходе с created на waitingForOpening отправляем начальное уведомление
          if (
            oldStatus === ExtendedMeetStatus.CREATED &&
            extendedStatus === ExtendedMeetStatus.WAITING_FOR_OPENING &&
            !trackedMeet.notifications.initialNotification
          ) {
            await this.notificationSender.sendInitialNotification(trackedMeet);
            trackedMeet.notifications.initialNotification = true;
          }

          // При переходе в VOTING_IN_PROGRESS отправляем уведомление о начале собрания
          if (extendedStatus === ExtendedMeetStatus.VOTING_IN_PROGRESS && !trackedMeet.notifications.startNotification) {
            await this.notificationSender.sendStartNotification(trackedMeet);
            trackedMeet.notifications.startNotification = true;
          }
        }

        // Используем DateUtils для корректной работы с датами
        const openAt = DateUtils.convertUtcToLocalTime(trackedMeet.open_at);
        const closeAt = DateUtils.convertUtcToLocalTime(trackedMeet.close_at);

        // Проверяем, нужно ли отправить уведомление за указанное время до начала
        if (!trackedMeet.notifications.threeDaysBeforeStart && extendedStatus === ExtendedMeetStatus.WAITING_FOR_OPENING) {
          // Вычисляем время, за которое нужно отправить уведомление
          const minutesBeforeStart = this.pluginConfig.config.minutesBeforeStartNotification;
          const msBeforeStart = minutesBeforeStart * 60 * 1000;
          const notificationTime = new Date(openAt.getTime() - msBeforeStart);

          // Проверяем, наступило ли время отправки уведомления
          if (now >= notificationTime) {
            await this.notificationSender.sendThreeDaysBeforeStartNotification(trackedMeet);
            trackedMeet.notifications.threeDaysBeforeStart = true;
          }
        }

        // Проверяем, нужно ли отправить уведомление за указанное время до завершения
        if (!trackedMeet.notifications.oneDayBeforeEnd && extendedStatus === ExtendedMeetStatus.VOTING_IN_PROGRESS) {
          // Вычисляем время, за которое нужно отправить уведомление
          const minutesBeforeEnd = this.pluginConfig.config.minutesBeforeEndNotification;
          const msBeforeEnd = minutesBeforeEnd * 60 * 1000;
          const notificationTime = new Date(closeAt.getTime() - msBeforeEnd);

          // Проверяем, наступило ли время отправки уведомления
          if (now >= notificationTime) {
            await this.notificationSender.sendOneDayBeforeEndNotification(trackedMeet);
            trackedMeet.notifications.oneDayBeforeEnd = true;
          }
        }
      }

      // Обновляем время последней проверки
      this.pluginConfig.config.lastCheckTimestamp = now.toISOString();

      // Сохраняем изменения в конфигурации
      await this.extensionRepository.update(this.pluginConfig);
    } catch (error: any) {
      this.logger.error(`Ошибка при проверке собраний: ${error.message}`, error.stack);
    }
  }

  // Получение всех аккаунтов с использованием пакетной загрузки
  async getAllAccounts(): Promise<AccountDomainEntity[]> {
    try {
      const batchSize = 100;
      let currentPage = 1;
      let hasMorePages = true;
      let allAccounts: AccountDomainEntity[] = [];

      this.logger.info(`Начало загрузки аккаунтов с размером пакета: ${batchSize}`);

      while (hasMorePages) {
        const accountsPage = await this.accountPort.getAccounts(
          {},
          {
            page: currentPage,
            limit: batchSize,
            sortOrder: 'DESC',
          }
        );

        allAccounts = [...allAccounts, ...accountsPage.items];

        if (accountsPage.currentPage >= accountsPage.totalPages || accountsPage.items.length === 0) {
          hasMorePages = false;
          this.logger.info(`Загрузка аккаунтов завершена. Всего загружено: ${allAccounts.length}`);
        } else {
          currentPage++;
          this.logger.info(`Загружена страница ${currentPage - 1}/${accountsPage.totalPages}, продолжаем загрузку...`);
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
