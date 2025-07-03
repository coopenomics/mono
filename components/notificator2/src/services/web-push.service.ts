import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as webpush from 'web-push';
import { PushSubscription } from '../entities/push-subscription.entity';

export interface PushSubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface NotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  image?: string;
  data?: any;
  actions?: Array<{
    action: string;
    title: string;
    icon?: string;
  }>;
  tag?: string;
  requireInteraction?: boolean;
  silent?: boolean;
  timestamp?: number;
  vibrate?: number[];
}

@Injectable()
export class WebPushService implements OnModuleInit {
  private readonly logger = new Logger(WebPushService.name);

  constructor(
    private configService: ConfigService,
    @InjectRepository(PushSubscription)
    private pushSubscriptionRepository: Repository<PushSubscription>,
  ) {}

  async onModuleInit() {
    await this.initializeWebPush();
  }

  /**
   * Инициализация web-push с VAPID ключами
   */
  private async initializeWebPush() {
    const vapidPublicKey = this.configService.get<string>('VAPID_PUBLIC_KEY');
    const vapidPrivateKey = this.configService.get<string>('VAPID_PRIVATE_KEY');
    const vapidSubject = this.configService.get<string>('VAPID_SUBJECT') || 'mailto:admin@coopenomics.io';

    if (!vapidPublicKey || !vapidPrivateKey) {
      this.logger.warn('VAPID ключи не настроены. Генерирую новые...');
      await this.generateVapidKeys();
      return;
    }

    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
    this.logger.log('Web-push сервис инициализирован с существующими VAPID ключами');
  }

  /**
   * Генерация новых VAPID ключей
   */
  private async generateVapidKeys() {
    const vapidKeys = webpush.generateVAPIDKeys();
    
    this.logger.log('Сгенерированы новые VAPID ключи:');
    this.logger.log(`VAPID_PUBLIC_KEY=${vapidKeys.publicKey}`);
    this.logger.log(`VAPID_PRIVATE_KEY=${vapidKeys.privateKey}`);
    this.logger.warn('ВНИМАНИЕ: Добавьте эти ключи в переменные окружения и перезапустите сервис!');

    // Временно устанавливаем ключи для текущей сессии
    const vapidSubject = this.configService.get<string>('VAPID_SUBJECT') || 'mailto:admin@coopenomics.io';
    webpush.setVapidDetails(vapidSubject, vapidKeys.publicKey, vapidKeys.privateKey);
  }

  /**
   * Получить публичный VAPID ключ для клиента
   */
  getVapidPublicKey(): string {
    return this.configService.get<string>('VAPID_PUBLIC_KEY') || '';
  }

  /**
   * Сохранить push подписку пользователя
   */
  async saveSubscription(userId: string, subscription: PushSubscriptionData, userAgent?: string): Promise<PushSubscription> {
    // Проверяем, есть ли уже такая подписка
    const existingSubscription = await this.pushSubscriptionRepository.findOne({
      where: { endpoint: subscription.endpoint }
    });

    if (existingSubscription) {
      // Обновляем существующую подписку
      existingSubscription.userId = userId;
      existingSubscription.p256dhKey = subscription.keys.p256dh;
      existingSubscription.authKey = subscription.keys.auth;
      existingSubscription.userAgent = userAgent;
      existingSubscription.isActive = true;
      
      return await this.pushSubscriptionRepository.save(existingSubscription);
    }

    // Создаем новую подписку
    const newSubscription = this.pushSubscriptionRepository.create({
      userId,
      endpoint: subscription.endpoint,
      p256dhKey: subscription.keys.p256dh,
      authKey: subscription.keys.auth,
      userAgent,
      isActive: true,
    });

    return await this.pushSubscriptionRepository.save(newSubscription);
  }

  /**
   * Удалить push подписку
   */
  async removeSubscription(endpoint: string): Promise<void> {
    await this.pushSubscriptionRepository.update(
      { endpoint },
      { isActive: false }
    );
  }

  /**
   * Получить все активные подписки пользователя
   */
  async getUserSubscriptions(userId: string): Promise<PushSubscription[]> {
    return await this.pushSubscriptionRepository.find({
      where: { userId, isActive: true }
    });
  }

  /**
   * Отправить push уведомление конкретному пользователю
   */
  async sendNotificationToUser(userId: string, payload: NotificationPayload): Promise<void> {
    const subscriptions = await this.getUserSubscriptions(userId);
    
    if (subscriptions.length === 0) {
      this.logger.warn(`Нет активных push подписок для пользователя ${userId}`);
      return;
    }

    await this.sendNotificationToSubscriptions(subscriptions, payload);
  }

  /**
   * Отправить push уведомление по конкретным подпискам
   */
  async sendNotificationToSubscriptions(subscriptions: PushSubscription[], payload: NotificationPayload): Promise<void> {
    const promises = subscriptions.map(async (subscription) => {
      try {
        const webPushSubscription = subscription.toWebPushSubscription();
        
        await webpush.sendNotification(
          webPushSubscription,
          JSON.stringify(payload),
          {
            TTL: 24 * 60 * 60, // 24 часа
            urgency: 'normal',
            topic: payload.tag,
          }
        );

        this.logger.debug(`Push уведомление отправлено: ${subscription.endpoint.substring(0, 50)}...`);
      } catch (error: any) {
        this.logger.error(`Ошибка отправки push уведомления для подписки ${subscription.id}:`, error.message);
        
        // Если подписка недействительна, деактивируем её
        if (error.statusCode === 410 || error.statusCode === 404) {
          await this.pushSubscriptionRepository.update(
            { id: subscription.id },
            { isActive: false }
          );
          this.logger.warn(`Подписка ${subscription.id} деактивирована (endpoint недоступен)`);
        }
      }
    });

    await Promise.allSettled(promises);
  }

  /**
   * Отправить push уведомление всем активным подпискам
   */
  async sendNotificationToAll(payload: NotificationPayload): Promise<void> {
    const subscriptions = await this.pushSubscriptionRepository.find({
      where: { isActive: true }
    });

    if (subscriptions.length === 0) {
      this.logger.warn('Нет активных push подписок');
      return;
    }

    this.logger.log(`Отправка push уведомления ${subscriptions.length} подпискам`);
    await this.sendNotificationToSubscriptions(subscriptions, payload);
  }

  /**
   * Получить статистику push подписок
   */
  async getSubscriptionStats() {
    const total = await this.pushSubscriptionRepository.count();
    const active = await this.pushSubscriptionRepository.count({
      where: { isActive: true }
    });
    const inactive = total - active;

    const uniqueUsers = await this.pushSubscriptionRepository
      .createQueryBuilder('subscription')
      .select('COUNT(DISTINCT subscription.userId)', 'count')
      .where('subscription.isActive = :isActive', { isActive: true })
      .getRawOne();

    return {
      total,
      active,
      inactive,
      uniqueUsers: parseInt(uniqueUsers.count),
    };
  }

  /**
   * Очистить неактивные подписки старше указанного количества дней
   */
  async cleanupInactiveSubscriptions(olderThanDays: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const result = await this.pushSubscriptionRepository
      .createQueryBuilder()
      .delete()
      .where('isActive = :isActive AND updatedAt < :cutoffDate', {
        isActive: false,
        cutoffDate
      })
      .execute();

    const deletedCount = result.affected || 0;
    this.logger.log(`Очищено ${deletedCount} неактивных подписок старше ${olderThanDays} дней`);
    
    return deletedCount;
  }
} 