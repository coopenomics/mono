import { Inject, Injectable, Logger } from '@nestjs/common';
import { Workflows } from '@coopenomics/notifications';
import { NotificationSenderService } from '~/application/notification/services/notification-sender.service';
import { ACCOUNT_DOMAIN_SERVICE, AccountDomainService } from '~/domain/account/services/account-domain.service';
import { BillingNotificationKind, BillingNotificationRequestDTO } from '../dto/billing-notification.dto';

/**
 * Epic 14 — мост биллинговых оповещений (Вариант А: провайдер → coopback → Novu).
 *
 * Провайдер (Восход backend) — owner данных подписок — по cron вычисляет повод
 * и шлёт notification-intent в coopback. Этот сервис маппит стабильный `kind`
 * на конкретный Novu-workflow и отправляет уведомление представителю
 * кооператива-пайщика (резолв subscriber_id/email — в NotificationSenderService).
 */
@Injectable()
export class BillingNotificationBridgeService {
  private readonly logger = new Logger(BillingNotificationBridgeService.name);

  /** Маппинг стабильного kind → id Novu-workflow (slug живёт в пакете notifications). */
  private static readonly WORKFLOW_BY_KIND: Record<BillingNotificationKind, string> = {
    [BillingNotificationKind.TRIAL_ENDING]: Workflows.TrialEnding.id,
    [BillingNotificationKind.PAYMENT_DUE]: Workflows.SubscriptionPaymentDue.id,
    [BillingNotificationKind.PAST_DUE]: Workflows.SubscriptionPastDue.id,
    [BillingNotificationKind.SUSPENDED]: Workflows.SubscriptionSuspended.id,
  };

  constructor(
    private readonly notificationSender: NotificationSenderService,
    @Inject(ACCOUNT_DOMAIN_SERVICE)
    private readonly accountDomainService: AccountDomainService
  ) {}

  /**
   * Обработать notification-intent от провайдера: обогатить payload
   * отображаемым именем кооператива и запустить workflow.
   * Идемпотентность/дедуп напоминаний — на стороне провайдера (Story 14.2).
   */
  async handleIntent(dto: BillingNotificationRequestDTO): Promise<void> {
    const workflowId = BillingNotificationBridgeService.WORKFLOW_BY_KIND[dto.kind];
    this.logger.log(`billing-notification: kind=${dto.kind} → workflow=${workflowId} coop=${dto.coopname}`);

    // Подставляем человекочитаемое имя кооператива, если провайдер его не прислал.
    const payload: Record<string, any> = { ...dto.payload };
    if (!payload.coopName) {
      payload.coopName = await this.accountDomainService.getDisplayName(dto.coopname);
    }

    await this.notificationSender.sendNotificationToUser(dto.coopname, workflowId, payload);
  }
}
