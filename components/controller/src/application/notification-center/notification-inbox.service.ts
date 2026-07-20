import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationInboxTypeormEntity } from '~/infrastructure/database/typeorm/entities/notification-inbox.typeorm-entity';
import type { PaginationInputDTO, PaginationResult } from '~/application/common/dto/pagination.dto';
import type { InboxNotificationDTO } from './graphql/inbox-notification.dto';

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
    @InjectRepository(NotificationInboxTypeormEntity)
    private readonly inboxRepository: Repository<NotificationInboxTypeormEntity>
  ) {}

  async getInbox(
    coopname: string,
    subscriberId: string,
    pagination: PaginationInputDTO
  ): Promise<PaginationResult<InboxNotificationDTO>> {
    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 10;

    const [rows, totalCount] = await this.inboxRepository.findAndCount({
      where: { coopname, recipientSubscriberId: subscriberId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      items: rows.map((r) => this.toDTO(r)),
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
      currentPage: page,
    };
  }

  async getUnreadCount(coopname: string, subscriberId: string): Promise<number> {
    return this.inboxRepository.count({
      where: { coopname, recipientSubscriberId: subscriberId, isRead: false },
    });
  }

  /** Отметить одно уведомление прочитанным. Ownership: только собственная строка получателя. */
  async markRead(id: string, subscriberId: string): Promise<InboxNotificationDTO> {
    const row = await this.inboxRepository.findOne({ where: { id, recipientSubscriberId: subscriberId } });
    if (!row) throw new NotFoundException(`Уведомление инбокса '${id}' не найдено`);

    if (!row.isRead) {
      row.isRead = true;
      row.readAt = new Date();
      await this.inboxRepository.save(row);
    }
    return this.toDTO(row);
  }

  /** Отметить все непрочитанные прочитанными. Возвращает число затронутых строк. */
  async markAllRead(coopname: string, subscriberId: string): Promise<number> {
    const result = await this.inboxRepository.update(
      { coopname, recipientSubscriberId: subscriberId, isRead: false },
      { isRead: true, readAt: new Date() }
    );
    return result.affected ?? 0;
  }

  private toDTO(r: NotificationInboxTypeormEntity): InboxNotificationDTO {
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
