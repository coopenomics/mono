import { Injectable, Inject, OnModuleInit } from '@nestjs/common';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';
import { NOTIFICATION_PORT, type NotificationPort } from '~/domain/notification/interfaces/notify.port';
import { ACCOUNT_DATA_PORT, AccountDataPort } from '~/domain/account/ports/account-data.port';
import { Workflows } from '@coopenomics/notifications';
import config from '~/config/config';

/**
 * Сервис для отправки уведомлений участникам
 */
@Injectable()
export class ParticipantNotificationService implements OnModuleInit {
  constructor(
    @Inject(NOTIFICATION_PORT)
    private readonly notificationPort: NotificationPort,
    @Inject(ACCOUNT_DATA_PORT)
    private readonly accountPort: AccountDataPort,
    private readonly logger: WinstonLoggerService
  ) {
    this.logger.setContext(ParticipantNotificationService.name);
  }

  async onModuleInit() {
    this.logger.log('ParticipantNotificationService инициализирован');
  }

  /**
   * Отправить приветственное уведомление новому пайщику после успешной регистрации
   */
  async sendWelcomeNotification(username: string): Promise<void> {
    try {
      this.logger.debug(`Отправка приветственного уведомления пользователю ${username}`);

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
      const payload: Workflows.Welcome.IPayload = {
        userName,
      };

      // Отправляем уведомление через Центр уведомлений
      await this.notificationPort.notify({
        coopname: config.coopname,
        workflowId: Workflows.Welcome.id,
        to: {
          subscriberId,
          email: userEmail,
          username,
        },
        payload,
      });
      this.logger.log(`Приветственное уведомление отправлено пользователю ${username}`);
    } catch (error: any) {
      this.logger.error(`Ошибка при отправке приветственного уведомления: ${error.message}`, error.stack);
    }
  }

  /**
   * Отправить уведомление председателю о новом заявке на вступительный взнос
   */
  async sendNewInitialPaymentNotification(
    participantUsername: string,
    paymentAmount: string,
    paymentCurrency: string,
    coopname: string
  ): Promise<void> {
    try {
      this.logger.debug(`Отправка уведомления председателю о новой заявке на вступительный взнос от ${participantUsername}`);

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
      const payload: Workflows.NewInitialPaymentRequest.IPayload = {
        chairmanName,
        participantName,
        paymentAmount,
        paymentCurrency,
        paymentType: 'Вступительный и минимальный паевой взнос',
        coopname,
        paymentUrl: `${config.frontend_url}`,
      };

      // Отправляем уведомление через Центр уведомлений
      await this.notificationPort.notify({
        coopname,
        workflowId: Workflows.NewInitialPaymentRequest.id,
        to: {
          subscriberId: chairmanSubscriberId,
          email: chairmanEmail,
          username: chairman.username,
        },
        payload,
      });
      this.logger.log(
        `Уведомление отправлено председателю ${chairman.username} о новой заявке на вступительный взнос от ${participantUsername}`
      );
    } catch (error: any) {
      this.logger.error(`Ошибка при отправке уведомления о новом вступительном взносе: ${error.message}`, error.stack);
    }
  }
}
