import { createHash } from 'crypto';
import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import config from '~/config/config';
import { NotificationOutboxTypeormEntity } from '~/infrastructure/database/typeorm/entities/notification-outbox.typeorm-entity';
import { NotificationDeliveryTypeormEntity } from '~/infrastructure/database/typeorm/entities/notification-delivery.typeorm-entity';
import { NotificationOutboxStatus } from '~/domain/notification/interfaces/notification-outbox.domain.interface';
import type { PaginationInputDTO, PaginationResult } from '~/application/common/dto/pagination.dto';
import type { NotificationsFilterInput } from './graphql/notifications-filter.input';
import type {
  NotificationDTO,
  NotificationDetailDTO,
  NotificationAttemptDTO,
} from './graphql/notification.dto';

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
    @InjectRepository(NotificationOutboxTypeormEntity)
    private readonly outboxRepository: Repository<NotificationOutboxTypeormEntity>,
    @InjectRepository(NotificationDeliveryTypeormEntity)
    private readonly deliveryRepository: Repository<NotificationDeliveryTypeormEntity>
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

    const where: Record<string, unknown> = { coopname: filter.coopname };
    if (filter.workflowId) where.workflowId = filter.workflowId;
    if (filter.channel) where.channel = filter.channel;
    if (filter.status) where.status = filter.status;
    if (filter.recipientSubscriberId) where.recipientSubscriberId = filter.recipientSubscriberId;

    const [rows, totalCount] = await this.outboxRepository.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      items: rows.map((r) => this.toNotificationDTO(r)),
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
      currentPage: page,
    };
  }

  async getNotification(id: string): Promise<NotificationDetailDTO> {
    const row = await this.outboxRepository.findOne({ where: { id } });
    if (!row) throw new NotFoundException(`Уведомление '${id}' не найдено`);
    this.assertOwnCoop(row.coopname);

    const deliveries = await this.deliveryRepository.find({
      where: { outboxId: id },
      order: { createdAt: 'ASC' },
    });

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
    const source = await this.outboxRepository.findOne({ where: { id } });
    if (!source) throw new NotFoundException(`Уведомление '${id}' не найдено`);
    this.assertOwnCoop(source.coopname);

    const resend = this.outboxRepository.create({
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
    const saved = await this.outboxRepository.save(resend);
    return this.toNotificationDTO(saved);
  }

  /** Доступ только к журналу собственного кооператива контроллера. */
  private assertOwnCoop(coopname: string): void {
    if (coopname !== config.coopname) {
      throw new ForbiddenException('Журнал уведомлений чужого кооператива недоступен');
    }
  }

  private resendIdempotencyKey(source: NotificationOutboxTypeormEntity): string {
    // Уникален относительно исходного ключа — иначе ON CONFLICT DO NOTHING съест переотправку.
    return createHash('sha256')
      .update(`${source.idempotencyKey}|resend|${new Date().toISOString()}|${source.id}`)
      .digest('hex')
      .slice(0, 64);
  }

  private toNotificationDTO(r: NotificationOutboxTypeormEntity): NotificationDTO {
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

  private toAttemptDTO(d: NotificationDeliveryTypeormEntity): NotificationAttemptDTO {
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
