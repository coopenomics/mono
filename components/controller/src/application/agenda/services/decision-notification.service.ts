import { Injectable, Inject, OnModuleInit } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';
import { NOTIFICATION_PORT, type NotificationPort } from '~/domain/notification/interfaces/notify.port';
import { ACCOUNT_DATA_PORT, AccountDataPort } from '~/domain/account/ports/account-data.port';
import config from '~/config/config';
import { SovietContract } from 'cooptypes';
import type { ActionDomainInterface } from '~/domain/parser/interfaces/action-domain.interface';
import { Workflows } from '@coopenomics/notifications';

/**
 * Сервис для отправки уведомлений о принятых решениях совета
 *
 * Подписывается на действие soviet::newdecision и отправляет уведомление
 * пользователю о принятии решения по его вопросу
 */
@Injectable()
export class DecisionNotificationService implements OnModuleInit {
  constructor(
    @Inject(NOTIFICATION_PORT)
    private readonly notificationPort: NotificationPort,
    @Inject(ACCOUNT_DATA_PORT)
    private readonly accountPort: AccountDataPort,
    private readonly logger: WinstonLoggerService
  ) {
    this.logger.setContext(DecisionNotificationService.name);
  }

  async onModuleInit() {
    this.logger.log('DecisionNotificationService инициализирован');
  }

  /**
   * Обработчик действия soviet::newdecision
   * Отправляет уведомление пользователю о принятии решения совета по его вопросу
   */
  @OnEvent(`action::${SovietContract.contractName.production}::newdecision`)
  async handleNewDecision(actionData: ActionDomainInterface): Promise<void> {
    try {
      const action = actionData.data as SovietContract.Interfaces.INewdecision;
      const decisionId = action.package.substring(0, 4);
      // Проверяем что это наш кооператив
      if (action.coopname !== config.coopname) {
        return;
      }

      this.logger.debug(`Обработка нового решения совета: ${action.package}`);

      // Получаем username из действия
      const username = action.username;
      if (!username) {
        this.logger.warn(`Username не найден в действии ${action.package}`);
        return;
      }

      // Получаем пользователя через порт
      const user = await this.accountPort.getAccount(username);
      const userEmail = user.provider_account?.email;
      const subscriberId = user.provider_account?.subscriber_id?.trim();
      if (!subscriberId) {
        this.logger.warn(`subscriber_id пользователя ${username} не найден`);
        return;
      }
      if (!userEmail) {
        this.logger.warn(`Email пользователя ${username} не найден`);
        return;
      }

      // Получаем отображаемое имя пользователя
      const userName = await this.accountPort.getDisplayName(username);

      // Формируем данные для workflow (без приватных данных)
      const payload: Workflows.DecisionApproved.IPayload = {
        userName,
        decisionTitle: `Решение №${decisionId}`,
        coopname: action.coopname,
        decision_id: decisionId,
        decisionUrl: `${config.frontend_url}`,
      };

      // Отправляем уведомление через Центр уведомлений
      await this.notificationPort.notify({
        coopname: action.coopname,
        workflowId: Workflows.DecisionApproved.id,
        to: {
          subscriberId,
          email: userEmail,
          username,
        },
        payload,
      });
      this.logger.log(`Уведомление отправлено пользователю ${username} о принятии решения ${decisionId}`);
    } catch (error: any) {
      this.logger.error(`Ошибка при обработке нового решения совета: ${error.message}`, error.stack);
    }
  }
}
