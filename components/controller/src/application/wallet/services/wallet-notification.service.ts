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
 * Сервис для отправки уведомлений по wallet модулю
 */
@Injectable()
export class WalletNotificationService implements OnModuleInit {
  constructor(
    @Inject(NOTIFICATION_PORT)
    private readonly notificationPort: INotificationPort,
    @Inject(ACCOUNT_DATA_PORT)
    private readonly accountPort: AccountDataPort,
    private readonly logger: WinstonLoggerService,
    private readonly roleAssignments: RoleAssignmentsRegistry
  ) {
    this.logger.setContext(WalletNotificationService.name);
  }

  async onModuleInit() {
    this.logger.log('WalletNotificationService инициализирован');
  }

  /**
   * Задача кассы о новой заявке на паевой взнос: председателю и кассирам
   */
  async sendNewDepositPaymentNotification(
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
          workflowId: Workflows.NewDepositPaymentRequest.id,
          payloadFor: (recipientName): Workflows.NewDepositPaymentRequest.IPayload => ({
            chairmanName: recipientName,
            participantName,
            paymentAmount: AmountFormatterUtils.formatAmountSafe(paymentAmount),
            paymentCurrency,
            paymentType: t('wallet.walletNotification.paymentTypeShareContribution'),
            coopname,
            paymentUrl: cashierPaymentsUrl(config.frontend_url, coopname, participantUsername),
          }),
        }
      );
    } catch (error: any) {
      this.logger.error(`Ошибка при отправке уведомления о новом паевом взносе: ${error.message}`, error.stack);
    }
  }
}
