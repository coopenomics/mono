import { Injectable, Inject, OnModuleInit } from '@nestjs/common';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';
import { ACCOUNT_DATA_PORT, AccountDataPort } from '~/domain/account/ports/account-data.port';
import { Workflows } from '@coopenomics/notifications';
import config from '~/config/config';
import { RoleAssignmentsRegistry } from '~/application/access-roles/role-assignments.registry';
import { cashierPaymentsUrl, notifyCashDesk } from '~/application/rights/cash-desk-confirmers';
import { AmountFormatterUtils } from '@coopenomics/extension-kit';
import { NOTIFICATION_PORT, INotificationPort } from '@coopenomics/innercoop';
import { t } from '~/i18n';

/**
 * Сервис для отправки уведомлений участникам
 */
@Injectable()
export class ParticipantNotificationService implements OnModuleInit {
  constructor(
    @Inject(NOTIFICATION_PORT)
    private readonly notificationPort: INotificationPort,
    @Inject(ACCOUNT_DATA_PORT)
    private readonly accountPort: AccountDataPort,
    private readonly logger: WinstonLoggerService,
    private readonly roleAssignments: RoleAssignmentsRegistry
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
   * Задача кассы о новой заявке на вступительный взнос: председателю и кассирам
   */
  async sendNewInitialPaymentNotification(
    participantUsername: string,
    paymentAmount: string,
    paymentCurrency: string,
    coopname: string
  ): Promise<void> {
    try {
      const participantName = await this.accountPort.getDisplayName(participantUsername);
      // Задачу кассы получают председатель и пайщики с ролью «Кассир»; ссылка — реестр платежей стола кассира.
      await notifyCashDesk(
        { accounts: this.accountPort, roles: this.roleAssignments, notifications: this.notificationPort, logger: this.logger },
        {
          coopname,
          workflowId: Workflows.NewInitialPaymentRequest.id,
          payloadFor: (recipientName): Workflows.NewInitialPaymentRequest.IPayload => ({
            recipientName: recipientName,
            participantName,
            paymentAmount: AmountFormatterUtils.formatAmountSafe(paymentAmount),
            paymentCurrency,
            paymentType: t('participation.participantNotificationService.entryAndMinShareLabel'),
            coopname,
            paymentUrl: cashierPaymentsUrl(config.frontend_url, coopname, participantUsername),
          }),
        }
      );
    } catch (error: any) {
      this.logger.error(`Ошибка при отправке уведомления о новом вступительном взносе: ${error.message}`, error.stack);
    }
  }
}
