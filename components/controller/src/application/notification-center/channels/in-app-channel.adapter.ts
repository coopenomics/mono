import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationInboxTypeormEntity } from '~/infrastructure/database/typeorm/entities/notification-inbox.typeorm-entity';
import { NotificationChannel } from '~/domain/notification/interfaces/notify-input.domain.interface';
import type {
  ChannelDeliveryResult,
  ChannelMessage,
  InAppChannelPort,
} from '~/domain/notification/interfaces/channel.ports';
import { renderTemplate, resolveTemplate } from '../template.util';

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
    @InjectRepository(NotificationInboxTypeormEntity)
    private readonly inboxRepository: Repository<NotificationInboxTypeormEntity>
  ) {}

  async send(message: ChannelMessage): Promise<ChannelDeliveryResult> {
    const template = resolveTemplate(message.workflowId, NotificationChannel.IN_APP);
    const title = renderTemplate(template?.subject, message) || 'Уведомление';
    const body = renderTemplate(template?.body, message);

    try {
      const row = this.inboxRepository.create({
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
      const saved = await this.inboxRepository.save(row);
      return { delivered: true, providerResponse: `inbox:${saved.id}` };
    } catch (error: any) {
      this.logger.error(
        `Ошибка записи in-app уведомления для '${message.recipient.subscriberId}': ${error.message}`
      );
      return { delivered: false, error: error.message };
    }
  }
}
