import { Injectable, Logger, Inject } from '@nestjs/common';
import { WebPushSubscriptionDomainEntity } from '~/domain/notification/entities/web-push-subscription-domain.entity';
import {
  NotificationPort,
  NOTIFICATION_SUBSCRIPTION_PORT,
} from '~/domain/notification/interfaces/web-push-subscription.port';
import type { CreateSubscriptionInputDomainInterface } from '~/domain/notification/interfaces/create-subscription-input-domain.interface';
import type { SubscriptionStatsDomainInterface } from '~/domain/notification/interfaces/subscription-stats-domain.interface';
import type { NotificationPayloadDomainInterface } from '~/domain/notification/interfaces/notification-payload-domain.interface';
import type { WorkflowActorDomainInterface } from '~/domain/notification/interfaces/workflow-trigger-domain.interface';

/**
 * Интерактор для управления веб-пуш подписками
 * Содержит основную бизнес-логику работы с подписками
 */
@Injectable()
export class NotificationInteractor {
  private readonly logger = new Logger(NotificationInteractor.name);

  constructor(
    @Inject(NOTIFICATION_SUBSCRIPTION_PORT)
    private readonly webPushSubscriptionPort: NotificationPort
  ) {}

  /**
   * Создать или обновить веб-пуш подписку
   * @param data Входные данные для создания подписки
   * @returns Promise<WebPushSubscriptionDomainEntity>
   */
  async createOrUpdateSubscription(data: CreateSubscriptionInputDomainInterface): Promise<WebPushSubscriptionDomainEntity> {
    this.logger.log(`Создание/обновление подписки для пользователя ${data.username}`);

    // Валидация входных данных
    this.validateSubscriptionData(data);

    // Проверяем, существует ли уже подписка с таким endpoint
    const existingSubscription = await this.webPushSubscriptionPort.findByEndpoint(data.subscription.endpoint);

    if (existingSubscription) {
      // Обновляем существующую подписку
      const updatedSubscription = await this.webPushSubscriptionPort.updateSubscription(data.subscription.endpoint, {
        username: data.username,
        p256dhKey: data.subscription.keys.p256dh,
        authKey: data.subscription.keys.auth,
        userAgent: data.userAgent,
      });

      this.logger.log(`Подписка обновлена: ${updatedSubscription.id}`);
      return new WebPushSubscriptionDomainEntity(updatedSubscription);
    }

    // Создаем новую подписку
    const newSubscription = await this.webPushSubscriptionPort.saveSubscription({
      username: data.username,
      endpoint: data.subscription.endpoint,
      p256dhKey: data.subscription.keys.p256dh,
      authKey: data.subscription.keys.auth,
      userAgent: data.userAgent,
    });

    this.logger.log(`Новая подписка создана: ${newSubscription.id}`);
    return new WebPushSubscriptionDomainEntity(newSubscription);
  }

  /**
   * Получить все активные подписки пользователя
   * @param username Username пользователя
   * @returns Promise<WebPushSubscriptionDomainEntity[]>
   */
  async getUserSubscriptions(username: string): Promise<WebPushSubscriptionDomainEntity[]> {
    this.logger.debug(`Получение подписок для пользователя ${username}`);

    const subscriptions = await this.webPushSubscriptionPort.getUserSubscriptions(username);
    return subscriptions.map((subscription) => new WebPushSubscriptionDomainEntity(subscription));
  }

  /**
   * Получить все активные подписки
   * @returns Promise<WebPushSubscriptionDomainEntity[]>
   */
  async getAllActiveSubscriptions(): Promise<WebPushSubscriptionDomainEntity[]> {
    this.logger.debug('Получение всех активных подписок');

    const subscriptions = await this.webPushSubscriptionPort.getAllActiveSubscriptions();
    return subscriptions.map((subscription) => new WebPushSubscriptionDomainEntity(subscription));
  }

  /**
   * Деактивировать подписку по endpoint
   * @param endpoint Endpoint подписки
   * @returns Promise<void>
   */
  async deactivateSubscription(endpoint: string): Promise<void> {
    this.logger.log(`Деактивация подписки с endpoint: ${endpoint.substring(0, 50)}...`);

    await this.webPushSubscriptionPort.deactivateSubscription(endpoint);
  }

  /**
   * Деактивировать подписку по ID
   * @param subscriptionId ID подписки
   * @returns Promise<void>
   */
  async deactivateSubscriptionById(subscriptionId: string): Promise<void> {
    this.logger.log(`Деактивация подписки с ID: ${subscriptionId}`);

    await this.webPushSubscriptionPort.deactivateSubscriptionById(subscriptionId);
  }

  /**
   * Очистить неактивные подписки
   * @param olderThanDays Количество дней
   * @returns Promise<number> Количество удаленных подписок
   */
  async cleanupInactiveSubscriptions(olderThanDays = 30): Promise<number> {
    this.logger.log(`Очистка неактивных подписок старше ${olderThanDays} дней`);

    const deletedCount = await this.webPushSubscriptionPort.cleanupInactiveSubscriptions(olderThanDays);

    this.logger.log(`Очищено ${deletedCount} неактивных подписок`);
    return deletedCount;
  }

  /**
   * Получить статистику подписок
   * @returns Promise<SubscriptionStatsDomainInterface>
   */
  async getSubscriptionStats(): Promise<SubscriptionStatsDomainInterface> {
    this.logger.debug('Получение статистики подписок');

    return await this.webPushSubscriptionPort.getSubscriptionStats();
  }

  /**
   * Отправить уведомление пользователю
   * Доменная логика проверяет наличие активных подписок
   * @param username Username пользователя
   * @param workflowName Имя воркфлоу
   * @param payload Данные уведомления
   * @param actor Данные отправителя (опционально)
   * @returns Promise<void>
   */
  async sendNotificationToUser(
    username: string,
    workflowName: string,
    payload: NotificationPayloadDomainInterface,
    actor?: WorkflowActorDomainInterface
  ): Promise<void> {
    this.logger.log(`Подготовка отправки уведомления пользователю ${username}: ${payload.title}`);

    // Проверяем наличие активных подписок
    const subscriptions = await this.getUserSubscriptions(username);

    if (subscriptions.length === 0) {
      this.logger.warn(`Нет активных подписок для пользователя ${username}`);
      throw new Error(`User ${username} has no active push subscriptions`);
    }

    this.logger.log(`Найдено ${subscriptions.length} активных подписок для пользователя ${username}`);
    this.logger.log(`Готов к отправке уведомления пользователю ${username} через воркфлоу ${workflowName}`);

    // Доменная логика завершена, фактическая отправка происходит в сервисе приложения
  }

  /**
   * Отправить уведомление нескольким пользователям
   * Доменная логика проверяет наличие активных подписок для каждого пользователя
   * @param usernames Массив username пользователей
   * @param workflowName Имя воркфлоу
   * @param payload Данные уведомления
   * @param actor Данные отправителя (опционально)
   * @returns Promise<string[]> Список пользователей с активными подписками
   */
  async sendNotificationToUsers(
    usernames: string[],
    workflowName: string,
    payload: NotificationPayloadDomainInterface,
    actor?: WorkflowActorDomainInterface
  ): Promise<string[]> {
    this.logger.log(`Подготовка отправки уведомления пользователям (${usernames.length}): ${payload.title}`);

    // Проверяем наличие активных подписок для каждого пользователя
    const usersWithSubscriptions: string[] = [];

    for (const username of usernames) {
      const subscriptions = await this.getUserSubscriptions(username);
      if (subscriptions.length > 0) {
        usersWithSubscriptions.push(username);
      }
    }

    if (usersWithSubscriptions.length === 0) {
      this.logger.warn(`Нет пользователей с активными подписками из ${usernames.length} пользователей`);
      throw new Error(`No users with active push subscriptions found`);
    }

    this.logger.log(`Найдено ${usersWithSubscriptions.length} пользователей с активными подписками из ${usernames.length}`);
    this.logger.log(
      `Готов к отправке уведомления пользователям (${usersWithSubscriptions.length}) через воркфлоу ${workflowName}`
    );

    return usersWithSubscriptions;
  }

  /**
   * Отправить уведомление всем пользователям
   * Доменная логика проверяет наличие активных подписок
   * @param workflowName Имя воркфлоу
   * @param payload Данные уведомления
   * @param actor Данные отправителя (опционально)
   * @returns Promise<number> Количество активных подписок
   */
  async sendNotificationToAll(
    workflowName: string,
    payload: NotificationPayloadDomainInterface,
    actor?: WorkflowActorDomainInterface
  ): Promise<number> {
    this.logger.log(`Подготовка отправки уведомления всем пользователям: ${payload.title}`);

    const subscriptions = await this.getAllActiveSubscriptions();

    if (subscriptions.length === 0) {
      this.logger.warn('Нет активных подписок');
      throw new Error('No active push subscriptions found');
    }

    this.logger.log(`Найдено ${subscriptions.length} активных подписок для отправки`);
    this.logger.log(`Готов к отправке уведомления всем пользователям через воркфлоу ${workflowName}`);

    return subscriptions.length;
  }

  /**
   * Синхронизировать device tokens пользователя с веб-пуш подписками
   * Доменная логика проверяет активные подписки
   * @param username Username пользователя
   * @returns Promise<number> Количество активных подписок пользователя
   */
  async syncUserDeviceTokens(username: string): Promise<number> {
    this.logger.log(`Проверка подписок для синхронизации device tokens: ${username}`);

    // Получаем активные подписки пользователя
    const subscriptions = await this.getUserSubscriptions(username);

    if (subscriptions.length === 0) {
      this.logger.warn(`Нет активных подписок для пользователя ${username}`);
      return 0;
    }

    this.logger.log(`Найдено ${subscriptions.length} активных подписок для пользователя ${username}`);
    this.logger.log(`Готов к синхронизации device tokens для пользователя ${username}`);

    return subscriptions.length;
  }

  /**
   * Валидация данных подписки
   * @param data Данные подписки
   */
  private validateSubscriptionData(data: CreateSubscriptionInputDomainInterface): void {
    if (!data.username || typeof data.username !== 'string') {
      throw new Error('username обязателен и должен быть строкой');
    }

    if (!data.subscription || typeof data.subscription !== 'object') {
      throw new Error('subscription обязателен и должен быть объектом');
    }

    if (!data.subscription.endpoint || typeof data.subscription.endpoint !== 'string') {
      throw new Error('endpoint обязателен и должен быть строкой');
    }

    if (!data.subscription.keys || typeof data.subscription.keys !== 'object') {
      throw new Error('keys обязательны и должны быть объектом');
    }

    if (!data.subscription.keys.p256dh || typeof data.subscription.keys.p256dh !== 'string') {
      throw new Error('p256dh ключ обязателен и должен быть строкой');
    }

    if (!data.subscription.keys.auth || typeof data.subscription.keys.auth !== 'string') {
      throw new Error('auth ключ обязателен и должен быть строкой');
    }
  }
}
