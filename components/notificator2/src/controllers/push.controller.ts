import {
  Controller,
  Post,
  Delete,
  Get,
  Body,
  Param,
  Headers,
  BadRequestException,
  Logger,
  Query,
} from '@nestjs/common';
import { WebPushService, PushSubscriptionData, NotificationPayload } from '../services/web-push.service';

export interface SubscribePushDto {
  userId: string;
  subscription: PushSubscriptionData;
}

export interface SendNotificationDto {
  userId?: string;
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
  vibrate?: number[];
}

@Controller('push')
export class PushController {
  private readonly logger = new Logger(PushController.name);

  constructor(private readonly webPushService: WebPushService) {}

  /**
   * Получить публичный VAPID ключ для клиента
   */
  @Get('vapid-public-key')
  getVapidPublicKey() {
    const publicKey = this.webPushService.getVapidPublicKey();
    
    if (!publicKey) {
      throw new BadRequestException('VAPID ключи не настроены. Проверьте конфигурацию сервера.');
    }

    return {
      publicKey,
      applicationServerKey: publicKey, // Alias для совместимости
    };
  }

  /**
   * Подписать пользователя на push уведомления
   */
  @Post('subscribe')
  async subscribe(
    @Body() dto: SubscribePushDto,
    @Headers('user-agent') userAgent?: string,
  ) {
    try {
      this.validateSubscription(dto.subscription);

      const subscription = await this.webPushService.saveSubscription(
        dto.userId,
        dto.subscription,
        userAgent,
      );

      this.logger.log(`Пользователь ${dto.userId} подписался на push уведомления`);

      return {
        success: true,
        message: 'Подписка на push уведомления успешно создана',
        subscriptionId: subscription.id,
      };
    } catch (error: any) {
      this.logger.error('Ошибка при подписке на push уведомления:', error.message);
      throw new BadRequestException(error.message);
    }
  }

  /**
   * Отписать пользователя от push уведомлений
   */
  @Delete('unsubscribe')
  async unsubscribe(@Body() body: { endpoint: string }) {
    try {
      if (!body.endpoint) {
        throw new BadRequestException('Endpoint обязателен для отписки');
      }

      await this.webPushService.removeSubscription(body.endpoint);

      this.logger.log(`Подписка отключена: ${body.endpoint.substring(0, 50)}...`);

      return {
        success: true,
        message: 'Подписка успешно отключена',
      };
    } catch (error: any) {
      this.logger.error('Ошибка при отписке от push уведомлений:', error.message);
      throw new BadRequestException(error.message);
    }
  }

  /**
   * Получить подписки пользователя
   */
  @Get('subscriptions/:userId')
  async getUserSubscriptions(@Param('userId') userId: string) {
    const subscriptions = await this.webPushService.getUserSubscriptions(userId);
    
    return {
      success: true,
      data: subscriptions.map(sub => ({
        id: sub.id,
        endpoint: sub.endpoint.substring(0, 50) + '...', // Скрываем полный endpoint в целях безопасности
        userAgent: sub.userAgent,
        createdAt: sub.createdAt,
        isActive: sub.isActive,
      })),
    };
  }

  /**
   * Отправить push уведомление пользователю
   */
  @Post('send')
  async sendNotification(@Body() dto: SendNotificationDto) {
    try {
      this.validateNotificationPayload(dto);

      const payload: NotificationPayload = {
        title: dto.title,
        body: dto.body,
        icon: dto.icon,
        badge: dto.badge,
        image: dto.image,
        data: dto.data,
        actions: dto.actions,
        tag: dto.tag,
        requireInteraction: dto.requireInteraction,
        silent: dto.silent,
        timestamp: Date.now(),
        vibrate: dto.vibrate,
      };

      if (dto.userId) {
        await this.webPushService.sendNotificationToUser(dto.userId, payload);
        this.logger.log(`Push уведомление отправлено пользователю ${dto.userId}`);
      } else {
        await this.webPushService.sendNotificationToAll(payload);
        this.logger.log('Push уведомление отправлено всем пользователям');
      }

      return {
        success: true,
        message: dto.userId 
          ? `Уведомление отправлено пользователю ${dto.userId}`
          : 'Уведомление отправлено всем пользователям',
      };
    } catch (error: any) {
      this.logger.error('Ошибка при отправке push уведомления:', error.message);
      throw new BadRequestException(error.message);
    }
  }

  /**
   * Отправить тестовое push уведомление
   */
  @Post('test/:userId')
  async sendTestNotification(@Param('userId') userId: string) {
    const payload: NotificationPayload = {
      title: '🔔 Тестовое уведомление',
      body: 'Ваши push уведомления работают корректно!',
      icon: '/icons/notification-icon.png',
      badge: '/icons/badge-icon.png',
      tag: 'test-notification',
      data: {
        type: 'test',
        timestamp: Date.now(),
      },
      actions: [
        {
          action: 'view',
          title: 'Открыть приложение',
        },
        {
          action: 'dismiss',
          title: 'Закрыть',
        },
      ],
    };

    await this.webPushService.sendNotificationToUser(userId, payload);

    return {
      success: true,
      message: `Тестовое уведомление отправлено пользователю ${userId}`,
    };
  }

  /**
   * Получить статистику push подписок
   */
  @Get('stats')
  async getStats() {
    const stats = await this.webPushService.getSubscriptionStats();
    
    return {
      success: true,
      data: stats,
    };
  }

  /**
   * Очистить неактивные подписки
   */
  @Delete('cleanup')
  async cleanup(@Query('days') days?: string) {
    const olderThanDays = days ? parseInt(days) : 30;
    
    if (isNaN(olderThanDays) || olderThanDays < 1) {
      throw new BadRequestException('Параметр days должен быть положительным числом');
    }

    const deletedCount = await this.webPushService.cleanupInactiveSubscriptions(olderThanDays);

    return {
      success: true,
      message: `Очищено ${deletedCount} неактивных подписок старше ${olderThanDays} дней`,
      deletedCount,
    };
  }

  /**
   * Валидация данных подписки
   */
  private validateSubscription(subscription: PushSubscriptionData) {
    if (!subscription.endpoint) {
      throw new Error('Endpoint подписки обязателен');
    }

    if (!subscription.keys?.p256dh || !subscription.keys?.auth) {
      throw new Error('Ключи p256dh и auth обязательны');
    }

    // Проверяем, что endpoint выглядит как валидный URL
    try {
      new URL(subscription.endpoint);
    } catch {
      throw new Error('Невалидный endpoint URL');
    }
  }

  /**
   * Валидация данных уведомления
   */
  private validateNotificationPayload(dto: SendNotificationDto) {
    if (!dto.title?.trim()) {
      throw new Error('Заголовок уведомления обязателен');
    }

    if (!dto.body?.trim()) {
      throw new Error('Текст уведомления обязателен');
    }

    if (dto.title.length > 100) {
      throw new Error('Заголовок уведомления не должен превышать 100 символов');
    }

    if (dto.body.length > 500) {
      throw new Error('Текст уведомления не должен превышать 500 символов');
    }
  }
} 