import { Injectable, Logger } from '@nestjs/common';
import { plainToClass } from 'class-transformer';
import { NotificationInteractor } from '../interactors/notification.interactor';
import { WebPushSubscriptionDto } from '../dto/web-push-subscription.dto';
import { CreateSubscriptionResponse } from '../dto/create-subscription-response.dto';
import { SubscriptionStatsDto } from '../dto/subscription-stats.dto';
import { CreateSubscriptionInput } from '../dto/create-subscription-input.dto';

@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);

  constructor(private readonly notificationInteractor: NotificationInteractor) {}

  /**
   * Создать веб-пуш подписку
   */
  async createSubscription(input: CreateSubscriptionInput): Promise<CreateSubscriptionResponse> {
    this.logger.log(`Создание подписки для пользователя: ${input.username}`);

    // Преобразуем plain object в экземпляр класса, чтобы получить доступ к методам
    const inputInstance = plainToClass(CreateSubscriptionInput, input);
    const domainInput = inputInstance.toDomainInterface();
    const subscription = await this.notificationInteractor.createOrUpdateSubscription(domainInput);

    const subscriptionDto = WebPushSubscriptionDto.fromDomainEntity(subscription);

    return new CreateSubscriptionResponse({
      success: true,
      message: 'Подписка успешно создана',
      subscription: subscriptionDto,
    });
  }

  /**
   * Получить подписки пользователя
   */
  async getUserSubscriptions(username: string): Promise<WebPushSubscriptionDto[]> {
    this.logger.debug(`Получение подписок для пользователя: ${username}`);

    const subscriptions = await this.notificationInteractor.getUserSubscriptions(username);
    return WebPushSubscriptionDto.fromDomainEntities(subscriptions);
  }

  /**
   * Деактивировать подписку по ID
   */
  async deactivateSubscriptionById(subscriptionId: string): Promise<void> {
    this.logger.log(`Деактивация подписки с ID: ${subscriptionId}`);
    await this.notificationInteractor.deactivateSubscriptionById(subscriptionId);
  }

  /**
   * Получить статистику подписок
   */
  async getSubscriptionStats(): Promise<SubscriptionStatsDto> {
    this.logger.debug('Получение статистики подписок');

    const stats = await this.notificationInteractor.getSubscriptionStats();
    return SubscriptionStatsDto.fromDomainInterface(stats);
  }

  /**
   * Очистить неактивные подписки (для внутреннего использования)
   */
  async cleanupInactiveSubscriptions(olderThanDays = 30): Promise<number> {
    this.logger.log(`Очистка неактивных подписок старше ${olderThanDays} дней`);

    const deletedCount = await this.notificationInteractor.cleanupInactiveSubscriptions(olderThanDays);
    this.logger.log(`Очищено ${deletedCount} неактивных подписок`);
    return deletedCount;
  }
}
