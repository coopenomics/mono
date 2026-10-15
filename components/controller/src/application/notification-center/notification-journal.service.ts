import { createHash } from 'crypto';
import { Inject, Injectable } from '@nestjs/common';
import config from '~/config/config';
import {
  NOTIFICATION_DELIVERY_REPOSITORY,
  NOTIFICATION_OUTBOX_REPOSITORY,
  type NotificationDeliveryRepository,
  type NotificationOutboxRepository,
} from '~/domain/notification/repositories/notification-store.repository';
import {
  NotificationOutboxStatus,
  type NotificationDeliveryDomainInterface,
  type NotificationOutboxDomainInterface,
} from '~/domain/notification/interfaces/notification-outbox.domain.interface';
import type { PaginationInputDTO, PaginationResult } from '@coopenomics/extension-kit';
import type { NotificationsFilterInput } from './graphql/notifications-filter.input';
import type {
  NotificationDTO,
  NotificationDetailDTO,
  NotificationAttemptDTO,
} from './graphql/notification.dto';
import { DomainError } from '@coopenomics/extension-kit';

/**
 * Журнал уведомлений Центра (стол председателя, эпик 6).
 *
 * Read-side очереди `notification_outbox` + журнала `notification_deliveries`:
 * листинг «кому/что/когда/каким каналом/статус», детализация попыток и
 * переотправка (force-постановка новой строки в очередь).
 */
@Injectable()
export class NotificationJournalService {
  constructor(
    @Inject(NOTIFICATION_OUTBOX_REPOSITORY)
    private readonly outboxRepository: NotificationOutboxRepository,
    @Inject(NOTIFICATION_DELIVERY_REPOSITORY)
    private readonly deliveryRepository: NotificationDeliveryRepository
  ) {}

  async listNotifications(
    filter: NotificationsFilterInput,
    pagination: PaginationInputDTO
  ): Promise<PaginationResult<NotificationDTO>> {
    // Federation-инвариант: контроллер обслуживает один кооператив. Журнал чужого
    // кооператива недоступен даже председателю (канон-паттерн coopname-guard).
    this.assertOwnCoop(filter.coopname);

    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 10;

    const [rows, totalCount] = await this.outboxRepository.findPage(
      {
        coopname: filter.coopname,
        workflowId: filter.workflowId,
        channel: filter.channel,
        status: filter.status,
        recipientSubscriberId: filter.recipientSubscriberId,
      },
      page,
      limit
    );

    return {
      items: rows.map((r) => this.toNotificationDTO(r)),
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
      currentPage: page,
    };
  }

  async getNotification(id: string): Promise<NotificationDetailDTO> {
    const row = await this.outboxRepository.findById(id);
    if (!row) throw DomainError.notFound('NOTIFICATION_CENTER_JOURNAL_ITEM_NOT_FOUND', { id });
    this.assertOwnCoop(row.coopname);

    const deliveries = await this.deliveryRepository.findByOutboxId(id);

    return {
      ...this.toNotificationDTO(row),
      deliveries: deliveries.map((d) => this.toAttemptDTO(d)),
    };
  }

  /**
   * Переотправка: создаёт НОВУЮ строку очереди из существующей. Свежий
   * `idempotencyKey` (с маркером resend) обходит дедупликацию исходной строки;
   * worker подхватывает и шлёт заново. Исходная строка/журнал не меняются.
   */
  async resendNotification(id: string): Promise<NotificationDTO> {
    const source = await this.outboxRepository.findById(id);
    if (!source) throw DomainError.notFound('NOTIFICATION_CENTER_JOURNAL_ITEM_NOT_FOUND', { id });
    this.assertOwnCoop(source.coopname);

    const saved = await this.outboxRepository.create({
      coopname: source.coopname,
      workflowId: source.workflowId,
      channel: source.channel,
      recipientSubscriberId: source.recipientSubscriberId,
      recipientEmail: source.recipientEmail,
      recipientUsername: source.recipientUsername,
      payload: source.payload,
      actorSubscriberId: source.actorSubscriberId,
      idempotencyKey: this.resendIdempotencyKey(source),
      status: NotificationOutboxStatus.PENDING,
      attempts: 0,
      maxAttempts: source.maxAttempts,
      scheduledAt: new Date(),
    });
    return this.toNotificationDTO(saved);
  }

  /** Доступ только к журналу собственного кооператива контроллера. */
  private assertOwnCoop(coopname: string): void {
    if (coopname !== config.coopname) {
      throw DomainError.forbidden('NOTIFICATION_CENTER_JOURNAL_FOREIGN_COOP');
    }
  }

  private resendIdempotencyKey(source: NotificationOutboxDomainInterface): string {
    // Уникален относительно исходного ключа — иначе ON CONFLICT DO NOTHING съест переотправку.
    return createHash('sha256')
      .update(`${source.idempotencyKey}|resend|${new Date().toISOString()}|${source.id}`)
      .digest('hex')
      .slice(0, 64);
  }

  private toNotificationDTO(r: NotificationOutboxDomainInterface): NotificationDTO {
    return {
      id: r.id,
      coopname: r.coopname,
      workflowId: r.workflowId,
      channel: r.channel,
      recipientSubscriberId: r.recipientSubscriberId,
      recipientUsername: r.recipientUsername,
      status: r.status,
      attempts: r.attempts,
      lastError: r.lastError,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }

  private toAttemptDTO(d: NotificationDeliveryDomainInterface): NotificationAttemptDTO {
    return {
      id: d.id,
      attemptNumber: d.attemptNumber,
      status: d.status,
      providerResponse: d.providerResponse,
      error: d.error,
      createdAt: d.createdAt,
    };
  }
}
