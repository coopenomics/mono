import { Injectable, Inject, OnModuleInit } from '@nestjs/common';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';
import { NOTIFICATION_PORT, type NotificationPort } from '~/domain/notification/interfaces/notify.port';
import { ACCOUNT_DATA_PORT, AccountDataPort } from '~/domain/account/ports/account-data.port';
import config from '~/config/config';
import type { PaymentDomainEntity } from '~/domain/gateway/entities/payment-domain.entity';
import { PaymentStatusEnum } from '~/domain/gateway/enums/payment-status.enum';
import { PaymentDirectionEnum } from '~/domain/gateway/enums/payment-type.enum';
import { Workflows } from '@coopenomics/notifications';

/**
 * Сервис для отправки уведомлений о статусе платежей
 */
@Injectable()
export class PaymentNotificationService implements OnModuleInit {
  constructor(
    @Inject(NOTIFICATION_PORT)
    private readonly notificationPort: NotificationPort,
    @Inject(ACCOUNT_DATA_PORT)
    private readonly accountPort: AccountDataPort,
    private readonly logger: WinstonLoggerService
  ) {
    this.logger.setContext(PaymentNotificationService.name);
  }

  async onModuleInit() {
    this.logger.log('PaymentNotificationService инициализирован');
  }

  /**
   * Отправить уведомление о статусе платежа
   */
  async notifyPaymentStatus(payment: PaymentDomainEntity): Promise<void> {
    try {
      // Отправляем уведомления только для оплаченных и отмененных платежей
      if (payment.status !== PaymentStatusEnum.PAID && payment.status !== PaymentStatusEnum.CANCELLED) {
        return;
      }

      this.logger.debug(`Отправка уведомления о платеже ${payment.id} со статусом ${payment.status}`);

      // Получаем пользователя через порт
      const user = await this.accountPort.getAccount(payment.username);
      const userEmail = user.provider_account?.email;
      const subscriberId = user.provider_account?.subscriber_id?.trim();
      if (!subscriberId) {
        this.logger.warn(`subscriber_id пользователя ${payment.username} не найден`);
        return;
      }
      if (!userEmail) {
        this.logger.warn(`Email пользователя ${payment.username} не найден`);
        return;
      }

      // Получаем отображаемое имя пользователя
      const userName = await this.accountPort.getDisplayName(payment.username);

      // Выбираем workflow по статусу И направлению — но БЕЗ привязки к типу платежа
      // (мы не всегда знаем, это возврат взноса, аванс под отчёт или доплата).
      // Исходящий PAID → пайщик получил деньги → «Платёж выполнен»; входящий PAID →
      // кооператив принял платёж пайщика → «Платёж принят». Оба текста универсальны.
      const isOutgoing = payment.direction === PaymentDirectionEnum.OUTGOING;
      const workflowId =
        payment.status === PaymentStatusEnum.PAID
          ? isOutgoing
            ? Workflows.PaymentRefunded.id
            : Workflows.PaymentPaid.id
          : Workflows.PaymentCancelled.id;

      // Формируем данные для workflow (без приватных данных)
      const payload: Workflows.PaymentPaid.IPayload | Workflows.PaymentCancelled.IPayload = {
        userName,
        paymentAmount: payment.quantity.toFixed(2),
        paymentCurrency: payment.symbol,
        paymentDate: payment.created_at.toLocaleString('ru-RU'),
        paymentUrl: `${config.frontend_url}`, //TODO: точную ссылку потом
      };

      // Отправляем уведомление через Центр уведомлений
      await this.notificationPort.notify({
        coopname: config.coopname,
        workflowId,
        to: {
          subscriberId,
          email: userEmail,
          username: payment.username,
        },
        payload,
      });
      this.logger.log(
        `Уведомление отправлено пользователю ${payment.username} о статусе платежа ${payment.id} (${payment.status})`
      );
    } catch (error: any) {
      this.logger.error(`Ошибка при отправке уведомления о платеже: ${error.message}`, error.stack);
    }
  }
}
