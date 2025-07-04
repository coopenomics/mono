import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { WebPushService } from './web-push.service';

@Injectable()
export class CleanupService {
  private readonly logger = new Logger(CleanupService.name);

  constructor(private readonly webPushService: WebPushService) {}

  /**
   * Автоматическая очистка неактивных подписок каждый день в 2:00
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async cleanupInactiveSubscriptions() {
    this.logger.log('Запуск автоматической очистки неактивных push подписок...');

    try {
      const deletedCount = await this.webPushService.cleanupInactiveSubscriptions(30);
      this.logger.log(`Автоматическая очистка завершена. Удалено ${deletedCount} неактивных подписок.`);
    } catch (error: any) {
      this.logger.error('Ошибка автоматической очистки:', error.message);
    }
  }

  /**
   * Еженедельная статистика push подписок (каждое воскресенье в 12:00)
   */
  @Cron('0 12 * * 0') // Каждое воскресенье в 12:00
  async logWeeklyStats() {
    this.logger.log('Генерация еженедельной статистики push подписок...');

    try {
      const stats = await this.webPushService.getSubscriptionStats();
      
      this.logger.log(`📊 Еженедельная статистика push подписок:`);
      this.logger.log(`   Всего подписок: ${stats.total}`);
      this.logger.log(`   Активных: ${stats.active}`);
      this.logger.log(`   Неактивных: ${stats.inactive}`);
      this.logger.log(`   Уникальных пользователей: ${stats.uniqueUsers}`);
      
      const activePercentage = stats.total > 0 ? ((stats.active / stats.total) * 100).toFixed(1) : '0';
      this.logger.log(`   Процент активных подписок: ${activePercentage}%`);
    } catch (error: any) {
      this.logger.error('Ошибка генерации статистики:', error.message);
    }
  }

  /**
   * Ручная очистка с заданными параметрами
   */
  async manualCleanup(olderThanDays: number) {
    this.logger.log(`Запуск ручной очистки подписок старше ${olderThanDays} дней...`);

    try {
      const deletedCount = await this.webPushService.cleanupInactiveSubscriptions(olderThanDays);
      this.logger.log(`Ручная очистка завершена. Удалено ${deletedCount} неактивных подписок.`);
      return deletedCount;
    } catch (error: any) {
      this.logger.error('Ошибка ручной очистки:', error.message);
      throw error;
    }
  }
} 