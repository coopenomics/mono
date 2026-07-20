import { Inject, Injectable, Logger } from '@nestjs/common';
import { WebPushService } from '~/application/notification/services/web-push.service';
import { WebPushSubscriptionDto } from '~/application/notification/dto/web-push-subscription.dto';
import { WebPushSubscriptionDomainEntity } from '~/domain/notification/entities/web-push-subscription-domain.entity';
import {
  NOTIFICATION_SUBSCRIPTION_PORT,
  type NotificationPort as WebPushSubscriptionPort,
} from '~/domain/notification/interfaces/web-push-subscription.port';
import { NotificationChannel } from '~/domain/notification/interfaces/notify-input.domain.interface';
import type {
  ChannelDeliveryResult,
  ChannelMessage,
  WebPushChannelPort,
} from '~/domain/notification/interfaces/channel.ports';
import { renderTemplate, resolveTemplate } from '../template.util';

/**
 * Канал «Веб-пуш» — реализация {@link WebPushChannelPort}.
 *
 * Контроллер кооператива доставляет **сам своим подписчикам напрямую**: берёт их
 * push-endpoint'ы из локальной таблицы `web_push_subscriptions` (по `username`) и
 * шлёт через {@link WebPushService}. Никакой центральной маршрутизации — каждый
 * кооператив доставляет себе сам (этим закрывается баг неработающих пушей; дело
 * в точках доставки, не в VAPID-ключах). Невалидные подписки (410) деактивируются.
 */
@Injectable()
export class WebPushChannelAdapter implements WebPushChannelPort {
  private readonly logger = new Logger(WebPushChannelAdapter.name);

  constructor(
    private readonly webPushService: WebPushService,
    @Inject(NOTIFICATION_SUBSCRIPTION_PORT)
    private readonly subscriptionPort: WebPushSubscriptionPort
  ) {}

  async send(message: ChannelMessage): Promise<ChannelDeliveryResult> {
    const username = message.recipient.username;
    if (!username) {
      // Нет адресации web-push — канал неприменим, не ошибка.
      return { delivered: false, skipped: true, error: 'у получателя нет username для web-push' };
    }

    const subscriptions = await this.subscriptionPort.getUserSubscriptions(username);
    if (subscriptions.length === 0) {
      // Получатель не подписан на push (не дал разрешения / нет PWA / подписка
      // протухла). Канал неприменим — мягкий пропуск, без ретраев и ошибки.
      return {
        delivered: false,
        skipped: true,
        error: `у получателя '${username}' нет активной push-подписки`,
      };
    }

    const template = resolveTemplate(message.workflowId, NotificationChannel.PUSH);
    const title = renderTemplate(template?.subject, message) || 'Уведомление';
    const body = renderTemplate(template?.body, message);

    // info-уровень: видно сколько эндпоинтов адресуем (диагностика «push не пришёл»).
    this.logger.log(`web-push → '${username}': ${subscriptions.length} активн. подписк(а), workflow=${message.workflowId}`);

    let anyDelivered = false;
    for (const subscription of subscriptions) {
      const dto = new WebPushSubscriptionDto(new WebPushSubscriptionDomainEntity(subscription));
      const ok = await this.webPushService.sendNotification(
        dto,
        { title, body },
        // 410 Gone — деактивируем мёртвую подписку.
        async (_subscriptionId: string) => {
          await this.subscriptionPort.deactivateSubscription(subscription.endpoint);
        }
      );
      anyDelivered = anyDelivered || ok;
    }

    return anyDelivered
      ? { delivered: true, providerResponse: `sent to ${subscriptions.length} subscription(s)` }
      : { delivered: false, error: 'all web-push subscriptions failed' };
  }
}
