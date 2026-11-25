import { Inject, Injectable } from '@nestjs/common';
import {
  InnerNotifyDeliveryState,
  type INotificationPort,
  type InnerNotifyActor,
  type InnerNotifyDelivery,
  type InnerNotifyInput,
  type InnerNotifyResult,
} from '@coopenomics/innercoop';
import config from '~/config/config';
import {
  NOTIFICATION_OUTBOX_REPOSITORY,
  type NotificationOutboxRepository,
} from '~/domain/notification/repositories/notification-store.repository';
import { NotificationService } from '~/application/notification-center/notification.service';
import { NotificationSenderService } from '~/application/notification/services/notification-sender.service';

/**
 * Реализация `INotificationPort` для расширений.
 *
 * Сводит в один контракт две операции, за которыми расширения раньше ходили в
 * два разных сервиса ядра: постановку уведомления с готовым получателем и
 * отправку по учётному имени. Второе требует доступа к учётным записям, чтобы
 * найти идентификатор подписчика, — расширению этот доступ не нужен.
 */
@Injectable()
export class NotificationInnercoopAdapter implements INotificationPort {
  constructor(
    private readonly notificationService: NotificationService,
    private readonly notificationSenderService: NotificationSenderService,
    @Inject(NOTIFICATION_OUTBOX_REPOSITORY) private readonly outboxRepository: NotificationOutboxRepository
  ) {}

  async notify(input: InnerNotifyInput): Promise<InnerNotifyResult> {
    return this.notificationService.notify(input);
  }

  async notifyUser<T extends Record<string, unknown>>(
    username: string,
    workflowId: string,
    payload: T,
    actor?: InnerNotifyActor
  ): Promise<InnerNotifyResult> {
    return this.notificationSenderService.sendNotificationToUser(username, workflowId, payload, actor);
  }

  /**
   * Доставка писем расширения по идентификаторам очереди. Запрос идёт
   * пачками: рассылка всем пайщикам даёт тысячи строк, а список в условии
   * `IN` разумно держать коротким. Строки другого кооператива не отдаются.
   */
  async getDeliveries(outboxIds: string[]): Promise<InnerNotifyDelivery[]> {
    const ids = [...new Set(outboxIds.filter(Boolean))];
    const result: InnerNotifyDelivery[] = [];
    for (let start = 0; start < ids.length; start += DELIVERY_BATCH) {
      const rows = await this.outboxRepository.findByIds(ids.slice(start, start + DELIVERY_BATCH));
      for (const row of rows) {
        if (row.coopname !== config.coopname) continue;
        result.push({ outboxId: row.id, channel: row.channel, state: row.status as unknown as InnerNotifyDeliveryState });
      }
    }
    return result;
  }
}

/** Размер пачки идентификаторов в одном запросе к очереди. */
const DELIVERY_BATCH = 500;
