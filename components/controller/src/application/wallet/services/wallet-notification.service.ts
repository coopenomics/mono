import { Injectable, Inject, OnModuleInit } from '@nestjs/common';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';
import { NOTIFICATION_PORT, type NotificationPort } from '~/domain/notification/interfaces/notify.port';
import { ACCOUNT_DATA_PORT, AccountDataPort } from '~/domain/account/ports/account-data.port';
import { Workflows } from '@coopenomics/notifications';
import config from '~/config/config';

/**
 * Сервис для отправки уведомлений по wallet модулю
 */
@Injectable()
export class WalletNotificationService implements OnModuleInit {
  constructor(
    @Inject(NOTIFICATION_PORT)
    private readonly notificationPort: NotificationPort,
    @Inject(ACCOUNT_DATA_PORT)
    private readonly accountPort: AccountDataPort,
    private readonly logger: WinstonLoggerService
  ) {
    this.logger.setContext(WalletNotificationService.name);
  }

  async onModuleInit() {
    this.logger.log('WalletNotificationService инициализирован');
  }

  /**
   * Отправить уведомление председателю о новом заявке на паевой взнос
   */
  async sendNewDepositPaymentNotification(
    participantUsername: string,
    paymentAmount: string,
    paymentCurrency: string,
    coopname: string
  ): Promise<void> {
    try {
      this.logger.debug(`Отправка уведомления председателю о новой заявке на паевой взнос от ${participantUsername}`);

      // Получаем председателя через порт
      const chairmen = await this.accountPort.getAccounts({ role: 'chairman' }, { page: 1, limit: 1, sortOrder: 'ASC' });
      if (!chairmen.items || chairmen.items.length === 0) {
        this.logger.warn('Председатель не найден, пропускаем отправку уведомления');
        return;
      }

      const chairman = chairmen.items[0];
      const chairmanEmail = chairman.provider_account?.email;
      const chairmanSubscriberId = chairman.provider_account?.subscriber_id?.trim();
      if (!chairmanSubscriberId) {
        this.logger.warn(`subscriber_id председателя ${chairman.username} не найден`);
        return;
      }
      if (!chairmanEmail) {
        this.logger.warn(`Email председателя ${chairman.username} не найден`);
        return;
      }

      // Получаем отображаемые имена
      const chairmanName = await this.accountPort.getDisplayName(chairman.username);
      const participantName = await this.accountPort.getDisplayName(participantUsername);

      // Формируем данные для workflow
      const payload: Workflows.NewDepositPaymentRequest.IPayload = {
        chairmanName,
        participantName,
        paymentAmount,
        paymentCurrency,
        paymentType: 'Паевой взнос по соглашению о ЦПП "Цифровой Кошелёк"',
        coopname,
        paymentUrl: `${config.frontend_url}`,
      };

      // Отправляем уведомление через Центр уведомлений
      await this.notificationPort.notify({
        coopname,
        workflowId: Workflows.NewDepositPaymentRequest.id,
        to: {
          subscriberId: chairmanSubscriberId,
          email: chairmanEmail,
          username: chairman.username,
        },
        payload,
      });
      this.logger.log(
        `Уведомление отправлено председателю ${chairman.username} о новой заявке на паевой взнос от ${participantUsername}`
      );
    } catch (error: any) {
      this.logger.error(`Ошибка при отправке уведомления о новом паевом взносе: ${error.message}`, error.stack);
    }
  }
}
