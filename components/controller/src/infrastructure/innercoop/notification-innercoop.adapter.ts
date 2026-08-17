import { Injectable } from '@nestjs/common';
import type {
  INotificationPort,
  InnerNotifyActor,
  InnerNotifyInput,
  InnerNotifyResult,
} from '@coopenomics/innercoop';
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
    private readonly notificationSenderService: NotificationSenderService
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
}
