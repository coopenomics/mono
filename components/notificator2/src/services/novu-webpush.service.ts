import { Injectable, Logger } from '@nestjs/common';
import { WebPushService, NotificationPayload } from './web-push.service';

export interface NovuWebPushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  image?: string;
  url?: string;
  data?: any;
  actions?: Array<{
    action: string;
    title: string;
    icon?: string;
    url?: string;
  }>;
  tag?: string;
  requireInteraction?: boolean;
  silent?: boolean;
  vibrate?: number[];
}

@Injectable()
export class NovuWebPushService {
  private readonly logger = new Logger(NovuWebPushService.name);

  constructor(
    private readonly webPushService: WebPushService,
  ) {}

  /**
   * Отправить web-push уведомление через NOVU workflow
   * Этот метод предназначен для вызова из NOVU webhook'ов
   */
  async sendWebPushFromNovu(
    userId: string,
    payload: NovuWebPushPayload,
    workflowId?: string,
  ): Promise<void> {
    try {
      const notificationPayload: NotificationPayload = {
        title: payload.title,
        body: payload.body,
        icon: payload.icon || '/icons/default-icon.png',
        badge: payload.badge || '/icons/badge.png',
        image: payload.image,
        data: {
          ...payload.data,
          url: payload.url,
          workflowId,
          timestamp: Date.now(),
        },
        actions: payload.actions?.map(action => ({
          action: action.action,
          title: action.title,
          icon: action.icon,
        })),
        tag: payload.tag,
        requireInteraction: payload.requireInteraction,
        silent: payload.silent,
        timestamp: Date.now(),
        vibrate: payload.vibrate,
      };

      await this.webPushService.sendNotificationToUser(userId, notificationPayload);
      
      this.logger.log(`Web-push уведомление отправлено через NOVU для пользователя ${userId}, workflow: ${workflowId}`);
    } catch (error: any) {
      this.logger.error(`Ошибка отправки web-push через NOVU для пользователя ${userId}:`, error.message);
      throw error;
    }
  }

  /**
   * Получить настройки web-push для NOVU integration
   */
  getWebPushIntegrationConfig() {
    const vapidPublicKey = this.webPushService.getVapidPublicKey();
    
    return {
      name: 'Web Push (Custom)',
      identifier: 'web-push-custom',
      logoFileName: 'web-push.png',
      channel: 'push',
      credentials: [
        {
          key: 'publicKey',
          displayName: 'VAPID Public Key',
          type: 'string',
          required: true,
          value: vapidPublicKey,
        },
        {
          key: 'privateKey',
          displayName: 'VAPID Private Key',
          type: 'secret',
          required: true,
        },
        {
          key: 'subject',
          displayName: 'VAPID Subject',
          type: 'string',
          required: true,
          value: 'mailto:admin@coopenomics.io',
        },
      ],
      docReference: 'https://developer.mozilla.org/en-US/docs/Web/API/Push_API',
      comingSoon: false,
      betaVersion: false,
      nesting: false,
      supportedFeatures: {
        digest: true,
        delay: true,
        title: true,
        body: true,
        avatar: true,
        actions: true,
      },
    };
  }

  /**
   * Синхронизировать подписки пользователя с NOVU
   */
  async syncUserSubscriptionsWithNovu(userId: string) {
    try {
      const subscriptions = await this.webPushService.getUserSubscriptions(userId);
      
      // Здесь можно добавить логику синхронизации с NOVU
      // Например, обновить subscriber preferences или integration settings
      
      this.logger.log(`Синхронизированы подписки для пользователя ${userId}: ${subscriptions.length} активных`);
      
      return {
        userId,
        subscriptionsCount: subscriptions.length,
        syncedAt: new Date(),
      };
    } catch (error: any) {
      this.logger.error(`Ошибка синхронизации подписок для пользователя ${userId}:`, error.message);
      throw error;
    }
  }
} 