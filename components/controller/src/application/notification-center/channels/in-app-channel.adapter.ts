import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  NOTIFICATION_INBOX_REPOSITORY,
  type NotificationInboxRepository,
} from '~/domain/notification/repositories/notification-store.repository';
import type {
  ChannelDeliveryResult,
  ChannelMessage,
  InAppChannelPort,
} from '~/domain/notification/interfaces/channel.ports';
import { renderTemplate, resolveTemplate } from '../template.util';
import { NotificationChannel } from '~/domain/notification/interfaces/notify-input.domain.interface';
import { t } from '~/i18n';

/**
 * Канал «In-app» — реализация {@link InAppChannelPort}.
 *
 * Доставка in-app = персист отрендеренного уведомления в `notification_inbox`
 * кооператива. Лента, `unreadCount`, отметка «прочитано» и live-подписка —
 * read-side инбокса (резолверы эпика 6), здесь только запись. Без подписки
 * фронт всё равно увидит уведомление при перезапросе ленты; live-слой —
 * отдельная инфраструктура GraphQL-подписок (эпик 6), не часть канала.
 */
@Injectable()
export class InAppChannelAdapter implements InAppChannelPort {
  private readonly logger = new Logger(InAppChannelAdapter.name);

  constructor(
    @Inject(NOTIFICATION_INBOX_REPOSITORY)
    private readonly inboxRepository: NotificationInboxRepository
  ) {}

  async send(message: ChannelMessage): Promise<ChannelDeliveryResult> {
    const template = resolveTemplate(message.workflowId, NotificationChannel.IN_APP, message.locale);
    const title = renderTemplate(template?.subject, message) || t('notificationCenter.inAppChannelAdapter.defaultTitle');
    const body = renderTemplate(template?.body, message);

    try {
      const saved = await this.inboxRepository.create({
        coopname: message.coopname,
        outboxId: message.outboxId,
        recipientSubscriberId: message.recipient.subscriberId,
        recipientUsername: message.recipient.username,
        workflowId: message.workflowId,
        title,
        body,
        payload: message.payload,
        actorSubscriberId: message.actorSubscriberId,
      });
      return { delivered: true, providerResponse: `inbox:${saved.id}` };
    } catch (error: any) {
      this.logger.error(
        `Ошибка записи in-app уведомления для '${message.recipient.subscriberId}': ${error.message}`
      );
      return { delivered: false, error: error.message };
    }
  }
}
