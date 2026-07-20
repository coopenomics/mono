import { Inject, Injectable } from '@nestjs/common';
import { NOTIFICATION_PORT, type NotificationPort } from '~/domain/notification/interfaces/notify.port';
import type { NotifyRecipient } from '~/domain/notification/interfaces/notify-input.domain.interface';
import {
  TriggerNotificationWorkflowInputDTO,
  NotificationWorkflowRecipientInputDTO,
} from '../dto/trigger-notification-workflow-input.dto';
import { AccountDomainService, ACCOUNT_DOMAIN_SERVICE } from '~/domain/account/services/account-domain.service';
import config from '~/config/config';

/**
 * Сервис для отправки уведомлений
 * Предоставляет интерфейс для внешнего триггинга воркфлоу уведомлений
 */
@Injectable()
export class NotificationService {
  constructor(
    @Inject(NOTIFICATION_PORT)
    private readonly notificationPort: NotificationPort,
    @Inject(ACCOUNT_DOMAIN_SERVICE)
    private readonly accountDomainService: AccountDomainService
  ) {}

  /**
   * Запускает воркфлоу уведомлений через Центр уведомлений
   * @param data Входные данные для триггера воркфлоу
   * @returns true если успешно, false если ошибка
   */
  async triggerNotificationWorkflow(data: TriggerNotificationWorkflowInputDTO): Promise<boolean> {
    try {
      await this.notificationPort.notify({
        coopname: config.coopname,
        workflowId: data.name,
        to: await this.mapRecipients(data.to),
        payload: data.payload,
      });
      return true;
    } catch (error) {
      // В случае ошибки возвращаем false
      return false;
    }
  }

  /**
   * Преобразует DTO получателей в доменных получателей Центра уведомлений
   */
  private async mapRecipients(dtoRecipients: NotificationWorkflowRecipientInputDTO[]): Promise<NotifyRecipient[]> {
    const recipients = await Promise.all(
      dtoRecipients.map(async (recipient) => {
        const account = await this.accountDomainService.getAccount(recipient.username);
        const subscriberId = account.provider_account?.subscriber_id?.trim();

        if (!subscriberId) {
          throw new Error(`Subscriber ID not found for user ${recipient.username}`);
        }

        return {
          subscriberId,
          email: account.provider_account?.email,
          username: recipient.username,
        };
      })
    );
    return recipients;
  }
}
