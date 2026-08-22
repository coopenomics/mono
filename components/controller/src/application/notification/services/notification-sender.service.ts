import { Inject, Injectable, Logger } from '@nestjs/common';
import type { WorkflowActorDomainInterface } from '~/domain/notification/interfaces/workflow-trigger-domain.interface';
import { ACCOUNT_DOMAIN_SERVICE, AccountDomainService } from '~/domain/account/services/account-domain.service';
import config from '~/config/config';
import type { InnerNotifyResult } from '@coopenomics/innercoop';
import { NotificationService as NotificationCenterService } from '~/application/notification-center/notification.service';

/**
 * Сервис отправки уведомлений пользователям через Центр уведомлений (DC v3).
 *
 * Тонкая обёртка `username → notify()`: резолвит получателя из аккаунта и ставит
 * уведомление в очередь Центра.
 */
@Injectable()
export class NotificationSenderService {
  private readonly logger = new Logger(NotificationSenderService.name);

  constructor(
    // Центр уведомлений зовётся напрямую, а не через `NOTIFICATION_PORT`.
    // Порт для расширений реализует `NotificationInnercoopAdapter`, и он же
    // зависит от этого сервиса: инъекция порта здесь замкнула бы граф
    // провайдеров в кольцо, на котором Nest не падает, а молча висит.
    private readonly notificationCenter: NotificationCenterService,
    @Inject(ACCOUNT_DOMAIN_SERVICE)
    private readonly accountDomainService: AccountDomainService
  ) {}

  /**
   * Отправить уведомление пользователю с типизированным payload.
   * @param username Username получателя
   * @param workflowName Тип уведомления (id из каталога @coopenomics/notifications)
   * @param payload Данные уведомления (типизированные для конкретного типа)
   * @param actor Инициатор уведомления (опционально)
   */
  async sendNotificationToUser<T extends Record<string, any>>(
    username: string,
    workflowName: string,
    payload: T,
    actor?: WorkflowActorDomainInterface
  ): Promise<InnerNotifyResult> {
    this.logger.log(`Отправка уведомления пользователю: ${username}, тип: ${workflowName}`);

    const account = await this.accountDomainService.getAccount(username);
    const subscriberId = account.provider_account?.subscriber_id?.trim();
    if (!subscriberId) {
      throw new Error(`Не удалось сформировать получателя для ${username}: нет subscriber_id в профиле`);
    }

    return this.notificationCenter.notify({
      coopname: config.coopname,
      workflowId: workflowName,
      to: {
        subscriberId,
        email: account.provider_account?.email,
        username,
      },
      payload,
      actor: actor ? { subscriberId: actor.subscriberId, email: actor.email } : undefined,
    });
  }
}
