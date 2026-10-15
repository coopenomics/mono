import { Inject, Injectable } from '@nestjs/common';
import {
  NOTIFICATION_INBOX_REPOSITORY,
  type NotificationInboxRepository,
} from '~/domain/notification/repositories/notification-store.repository';
import type { NotificationInboxDomainInterface } from '~/domain/notification/interfaces/notification-inbox.domain.interface';
import type { PaginationInputDTO, PaginationResult } from '@coopenomics/extension-kit';
import type { InboxNotificationDTO } from './graphql/inbox-notification.dto';
import { DomainError } from '@coopenomics/extension-kit';

/**
 * Личный инбокс пайщика (read-side канала In-app, эпик 6.6).
 *
 * Всегда скоупится парой `coopname` + `recipientSubscriberId` сессии: получатель
 * видит и меняет ТОЛЬКО свои строки — `subscriberId` берётся из JWT в резолвере,
 * не из аргументов клиента (иначе чтение чужого инбокса). Federation-инвариант:
 * у каждого кооператива свой инбокс, поэтому `coopname` обязателен в каждом запросе.
 */
@Injectable()
export class NotificationInboxService {
  constructor(
    @Inject(NOTIFICATION_INBOX_REPOSITORY)
    private readonly inboxRepository: NotificationInboxRepository
  ) {}

  async getInbox(
    coopname: string,
    subscriberId: string,
    pagination: PaginationInputDTO
  ): Promise<PaginationResult<InboxNotificationDTO>> {
    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 10;

    const [rows, totalCount] = await this.inboxRepository.findPage(coopname, subscriberId, page, limit);

    return {
      items: rows.map((r) => this.toDTO(r)),
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
      currentPage: page,
    };
  }

  async getUnreadCount(coopname: string, subscriberId: string): Promise<number> {
    return this.inboxRepository.countUnread(coopname, subscriberId);
  }

  /** Отметить одно уведомление прочитанным. Ownership: только собственная строка получателя. */
  async markRead(id: string, subscriberId: string): Promise<InboxNotificationDTO> {
    const row = await this.inboxRepository.findOwn(id, subscriberId);
    if (!row) throw DomainError.notFound('NOTIFICATION_CENTER_INBOX_ITEM_NOT_FOUND', { id });

    if (!row.isRead) {
      row.isRead = true;
      row.readAt = new Date();
      await this.inboxRepository.markRead(row.id, row.readAt);
    }
    return this.toDTO(row);
  }

  /** Отметить все непрочитанные прочитанными. Возвращает число затронутых строк. */
  async markAllRead(coopname: string, subscriberId: string): Promise<number> {
    return this.inboxRepository.markAllRead(coopname, subscriberId, new Date());
  }

  private toDTO(r: NotificationInboxDomainInterface): InboxNotificationDTO {
    return {
      id: r.id,
      workflowId: r.workflowId,
      title: r.title,
      body: r.body,
      payload: r.payload,
      actorSubscriberId: r.actorSubscriberId,
      isRead: r.isRead,
      readAt: r.readAt,
      createdAt: r.createdAt,
    };
  }
}
