// application/notification/services/notification-event.service.ts

import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationSenderService } from './notification-sender.service';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';
import { Workflows } from '@coopenomics/notifications';
import { UserDomainService, USER_DOMAIN_SERVICE } from '~/domain/user/services/user-domain.service';
import { Inject } from '@nestjs/common';
import { TokenContract } from 'cooptypes';
import type { IAction } from '~/types';
import { AmountFormatterUtils } from '~/shared/utils/amount-formatter.utils';

/**
 * Сервис обработки событий для отправки уведомлений
 * Подписывается на события из внутренней шины и отправляет уведомления пользователям
 */
@Injectable()
export class NotificationEventService {
  constructor(
    private readonly notificationSenderService: NotificationSenderService,
    private readonly logger: WinstonLoggerService,
    @Inject(USER_DOMAIN_SERVICE) private readonly userDomainService: UserDomainService
  ) {
    this.logger.setContext(NotificationEventService.name);
  }

  /**
   * Обработчик события перевода токенов для отправки уведомления
   */
  @OnEvent(`action::${TokenContract.contractName.production}::${TokenContract.Actions.Transfer.actionName}`)
  async handleTransferNotification(event: IAction): Promise<void> {
    try {
      await this.sendIncomingTransferNotification(event);
    } catch (error: any) {
      this.logger.error(`Ошибка отправки уведомления о переводе: ${error.message}`, error.stack);
      // Не перебрасываем ошибку чтобы не блокировать обработку других событий
    }
  }

  /**
   * Отправляет уведомление о входящем переводе
   */
  private async sendIncomingTransferNotification(action: IAction): Promise<void> {
    // Извлекаем данные перевода из события
    const transferData = action.data as TokenContract.Actions.Transfer.ITransfer;

    if (!transferData.to || !transferData.quantity) {
      this.logger.warn('Неполные данные перевода, пропускаем уведомление', { transferData });
      return;
    }

    if (action.receipt.receiver != TokenContract.contractName.production) return;

    const recipientUsername = transferData.to;
    const transferAmount = transferData.quantity;

    this.logger.info(`Processing transfer notification for user: ${recipientUsername}, amount: ${transferAmount}`);

    try {
      // Ищем пользователя по username (опциональный поиск)
      const user = await this.userDomainService.findUserByUsername(recipientUsername);

      // Если пользователь не найден, пропускаем уведомление
      if (!user) {
        this.logger.info(`User ${recipientUsername} not found in database, skipping notification`);
        return;
      }

      // Если у пользователя нет subscriber_id, пропускаем уведомление
      if (!user.subscriber_id) {
        this.logger.info(`User ${recipientUsername} has no subscriber_id, skipping notification`);
        return;
      }

      // Подготавливаем payload для уведомления согласно схеме из @coopenomics/notifications
      const notificationPayload: Workflows.NewTransfer.IPayload = {
        quantity: AmountFormatterUtils.formatAmountSafe(transferAmount),
      };

      // Отправляем уведомление используя воркфлоу из пакета @coopenomics/notifications
      await this.notificationSenderService.sendNotificationToUser(
        recipientUsername,
        Workflows.NewTransfer.id, // 'vkhodyaschiy-perevod'
        notificationPayload
      );

      this.logger.info(`Transfer notification sent to user: ${recipientUsername}`);
    } catch (error: any) {
      this.logger.error(
        `Ошибка отправки уведомления о переводе пользователю ${recipientUsername}: ${error.message}`,
        error.stack
      );
      // Не перебрасываем ошибку, чтобы не прерывать обработку других событий
    }
  }
}
