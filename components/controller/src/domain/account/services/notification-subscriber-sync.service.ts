import { Injectable, Logger, OnModuleInit, OnModuleDestroy, Inject } from '@nestjs/common';
import cron from 'node-cron';
import { generateSubscriberHash } from '~/utils/subscriber-hash.util';
import config from '~/config/config';
import { USER_DOMAIN_SERVICE, UserDomainService } from '~/domain/user/services/user-domain.service';

/**
 * Backfill identity получателя уведомлений: догенерирует `subscriber_id`/`subscriber_hash`
 * пользователям, у которых их нет (создание аккаунта ставит их в обычном потоке;
 * этот cron — страховка для legacy/сбойных профилей). `subscriber_id` — immutable
 * адресация Центра уведомлений; внешней синхронизации подписчиков больше нет.
 */
@Injectable()
export class NotificationSubscriberSyncService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationSubscriberSyncService.name);
  private isProcessing = false;
  private cronJob: cron.ScheduledTask | null = null;

  constructor(@Inject(USER_DOMAIN_SERVICE) private readonly userDomainService: UserDomainService) {}

  onModuleInit() {
    // Backfill identity каждые 30 минут
    this.cronJob = cron.schedule('*/30 * * * *', async () => {
      await this.syncNotificationSubscribers();
    });

    this.logger.log('node-cron backfill subscriber_id запущен (каждые 30 минут)');
  }

  onModuleDestroy() {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
      this.logger.log('node-cron задача для синхронизации подписчиков уведомлений остановлена');
    }
  }

  /**
   * Фоновая задача для синхронизации подписчиков уведомлений
   */
  async syncNotificationSubscribers(): Promise<void> {
    if (this.isProcessing) {
      this.logger.warn('Синхронизация подписчиков уже выполняется, пропускаем');
      return;
    }

    this.isProcessing = true;
    this.logger.debug('Начинаем синхронизацию подписчиков уведомлений');

    try {
      // Находим пользователей без subscriber_id
      const usersWithoutSubscriber = await this.userDomainService.findUsersWithoutSubscriberId();

      if (usersWithoutSubscriber.length === 0) {
        this.logger.debug('Все пользователи имеют subscriber_id');
        return;
      }

      this.logger.debug(`Найдено ${usersWithoutSubscriber.length} пользователей без subscriber_id`);

      let successCount = 0;
      let errorCount = 0;

      for (const user of usersWithoutSubscriber) {
        try {
          await this.setupSubscriberForUser(user.username);
          successCount++;
          this.logger.debug(`Подписчик создан для пользователя: ${user.username}`);
        } catch (error: any) {
          errorCount++;
          this.logger.error(`Не удалось создать подписчика для пользователя ${user.username}: ${error.message}`);
        }
      }

      this.logger.debug(`Синхронизация завершена. Успешно: ${successCount}, Ошибок: ${errorCount}`);
    } catch (error: any) {
      this.logger.error(`Не удалось выполнить синхронизацию подписчиков: ${error.message}`, error.stack);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Генерирует и сохраняет identity получателя (`subscriber_id`/`subscriber_hash`).
   * @param username Имя пользователя
   */
  private async setupSubscriberForUser(username: string): Promise<void> {
    try {
      const subscriberId = await this.userDomainService.generateSubscriberId(config.coopname);
      const subscriberHash = generateSubscriberHash(subscriberId);

      await this.userDomainService.updateUserByUsername(username, {
        subscriber_id: subscriberId,
        subscriber_hash: subscriberHash,
      });
    } catch (error: any) {
      this.logger.error(`Не удалось настроить identity получателя для ${username}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Ручной запуск синхронизации (для административных целей)
   */
  async manualSync(): Promise<{ success: number; errors: number }> {
    if (this.isProcessing) {
      throw new Error('Синхронизация уже выполняется');
    }

    this.logger.log('Запуск ручной синхронизации подписчиков');
    await this.syncNotificationSubscribers();

    return { success: 0, errors: 0 }; // Детали будут в логах
  }
}

export const NOTIFICATION_SUBSCRIBER_SYNC_SERVICE = Symbol('NOTIFICATION_SUBSCRIBER_SYNC_SERVICE');
