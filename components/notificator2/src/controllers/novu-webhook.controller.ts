import { Controller, Post, Body, Headers, Logger, BadRequestException, Get } from '@nestjs/common';
import { NovuWebPushService, NovuWebPushPayload } from '../services/novu-webpush.service';
import { WebPushService } from '../services/web-push.service';

export interface NovuWebhookPayload {
  event: string;
  data: {
    subscriber: {
      subscriberId: string;
      email?: string;
    };
    workflow: {
      id: string;
      name: string;
    };
    step: {
      type: string;
      template: any;
    };
    payload: any;
  };
  webhookId: string;
  timestamp: string;
}

@Controller('novu')
export class NovuWebhookController {
  private readonly logger = new Logger(NovuWebhookController.name);

  constructor(
    private readonly novuWebPushService: NovuWebPushService,
    private readonly webPushService: WebPushService,
  ) {}

  /**
   * Webhook для обработки push уведомлений от NOVU
   */
  @Post('webhook/push')
  async handlePushWebhook(
    @Body() payload: NovuWebhookPayload,
    @Headers('x-novu-signature') signature?: string,
  ) {
    try {
      this.logger.log(`Получен NOVU webhook: ${payload.event} для пользователя ${payload.data.subscriber.subscriberId}`);

      // Валидация webhook'а (в production следует проверять подпись)
      if (!this.isValidWebhook(payload, signature)) {
        throw new BadRequestException('Невалидный webhook');
      }

      // Обрабатываем только push уведомления
      if (payload.data.step.type !== 'push') {
        this.logger.warn(`Пропускаем событие ${payload.event} с типом ${payload.data.step.type}`);
        return { success: true, message: 'Событие пропущено (не push)' };
      }

      const userId = payload.data.subscriber.subscriberId;
      const workflowId = payload.data.workflow.id;

      // Извлекаем данные для push уведомления из template
      const pushPayload: NovuWebPushPayload = {
        title: this.extractTemplateValue(payload.data.step.template.content?.title, payload.data.payload),
        body: this.extractTemplateValue(payload.data.step.template.content?.body, payload.data.payload),
        icon: this.extractTemplateValue(payload.data.step.template.content?.icon, payload.data.payload),
        badge: this.extractTemplateValue(payload.data.step.template.content?.badge, payload.data.payload),
        image: this.extractTemplateValue(payload.data.step.template.content?.image, payload.data.payload),
        url: this.extractTemplateValue(payload.data.step.template.content?.data?.url, payload.data.payload),
        tag: this.extractTemplateValue(payload.data.step.template.content?.tag, payload.data.payload),
        requireInteraction: payload.data.step.template.content?.requireInteraction,
        silent: payload.data.step.template.content?.silent,
        data: {
          ...payload.data.payload,
          workflowId,
          webhookId: payload.webhookId,
        },
      };

      await this.novuWebPushService.sendWebPushFromNovu(userId, pushPayload, workflowId);

      return {
        success: true,
        message: `Push уведомление отправлено пользователю ${userId}`,
        workflowId,
        userId,
      };
    } catch (error: any) {
      this.logger.error('Ошибка обработки NOVU webhook:', error.message);
      throw new BadRequestException(error.message);
    }
  }

  /**
   * Endpoint для регистрации push подписки через NOVU
   */
  @Post('subscribe')
  async subscribeViaNovu(@Body() body: {
    userId: string;
    subscription: any;
    email?: string;
  }) {
    try {
      const { userId, subscription, email } = body;

      // Сохраняем подписку
      await this.webPushService.saveSubscription(userId, subscription);

      // Синхронизируем с NOVU
      await this.novuWebPushService.syncUserSubscriptionsWithNovu(userId);

      this.logger.log(`Пользователь ${userId} подписался через NOVU интеграцию`);

      return {
        success: true,
        message: 'Подписка создана и синхронизирована с NOVU',
        userId,
        email,
      };
    } catch (error: any) {
      this.logger.error('Ошибка подписки через NOVU:', error.message);
      throw new BadRequestException(error.message);
    }
  }

  /**
   * Получить конфигурацию web-push интеграции для NOVU
   */
  @Get('integration/config')
  getIntegrationConfig() {
    return this.novuWebPushService.getWebPushIntegrationConfig();
  }

  /**
   * Проверить работу webhook'а
   */
  @Post('test')
  async testWebhook(@Body() body: {
    userId: string;
    title?: string;
    body?: string;
  }) {
    const { userId, title = '🧪 Тест webhook', body: msgBody = 'Тестовое уведомление через webhook' } = body;

    const testPayload: NovuWebPushPayload = {
      title,
      body: msgBody,
      icon: '/icons/test-icon.png',
      badge: '/icons/badge.png',
      url: '/dashboard',
      tag: 'webhook-test',
      data: {
        type: 'webhook-test',
        timestamp: Date.now(),
      },
    };

    try {
      await this.novuWebPushService.sendWebPushFromNovu(userId, testPayload, 'test-webhook');

      return {
        success: true,
        message: `Тестовое уведомление отправлено пользователю ${userId}`,
        userId,
      };
    } catch (error: any) {
      this.logger.error('Ошибка теста webhook:', error.message);
      throw new BadRequestException(error.message);
    }
  }

  /**
   * Валидация webhook'а (в production следует проверять HMAC подпись)
   */
  private isValidWebhook(payload: NovuWebhookPayload, signature?: string): boolean {
    // TODO: Реализовать проверку подписи webhook'а
    // Пример:
    // const expectedSignature = createHmac('sha256', process.env.NOVU_WEBHOOK_SECRET)
    //   .update(JSON.stringify(payload))
    //   .digest('hex');
    // return signature === expectedSignature;
    
    // Пока просто проверяем базовую структуру
    return !!(
      payload &&
      payload.data &&
      payload.data.subscriber &&
      payload.data.subscriber.subscriberId &&
      payload.data.workflow &&
      payload.data.step
    );
  }

  /**
   * Извлечение значения из template с подстановкой переменных
   */
  private extractTemplateValue(template: string | undefined, payload: any): string | undefined {
    if (!template || typeof template !== 'string') {
      return template;
    }

    // Простая замена переменных формата {{variable}}
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return payload[key] || match;
    });
  }
} 