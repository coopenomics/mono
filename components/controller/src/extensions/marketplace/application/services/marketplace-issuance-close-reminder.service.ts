import { Inject, Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Workflows } from '@coopenomics/notifications';
import {
  ACCOUNT_PORT,
  LOGGER_PORT,
  NOTIFICATION_PORT,
  type IAccountPort,
  type ILoggerPort,
  type INotificationPort,
} from '@coopenomics/innercoop';
import { platformSettings } from '@coopenomics/extension-kit';
import {
  MARKETPLACE_ISSUANCE_SAGA_REPOSITORY,
  type MarketplaceIssuanceSagaDomainRepository,
} from '../../domain/repositories/marketplace-issuance-saga.repository';
import type { MarketplaceIssuanceSagaDomainEntity } from '../../domain/entities/marketplace-issuance-saga.entity';
import { MarketplaceOrderDisplayService } from './marketplace-order-display.service';

/** Через сколько после подписи акта пайщиком напоминать о закрывающей подписи. */
export const ISSUANCE_CLOSE_REMINDER_AFTER_MS = 60 * 60 * 1000;

/** Сколько напоминаний за прогон — защита от лавины уведомлений. */
const REMINDER_BATCH_LIMIT = 50;

/**
 * Напоминание о закрывающей подписи (99D-18, решение владельца 02.11.2026).
 *
 * Закрывающую подпись ставит стол оператора сам, в фоне, на любом столе
 * приложения. Если ни один стол оператора не был открыт, выдача висит, и
 * обеспечительная часть не переходит к списанию. Раз в десять минут крон
 * находит выдачи, где акт пайщика подписан больше часа назад, и один раз
 * напоминает оператору, открывшему выдачу. Отметка ставится до отправки:
 * два прогона не пришлют два письма.
 */
@Injectable()
export class MarketplaceIssuanceCloseReminderService {
  private running = false;

  constructor(
    @Inject(MARKETPLACE_ISSUANCE_SAGA_REPOSITORY)
    private readonly sagaRepo: MarketplaceIssuanceSagaDomainRepository,
    private readonly display: MarketplaceOrderDisplayService,
    @Inject(ACCOUNT_PORT) private readonly accountPort: IAccountPort,
    @Inject(NOTIFICATION_PORT) private readonly notifications: INotificationPort,
    @Inject(LOGGER_PORT) private readonly logger: ILoggerPort
  ) {
    this.logger.setContext(MarketplaceIssuanceCloseReminderService.name);
  }

  @Cron(CronExpression.EVERY_10_MINUTES)
  async tick(): Promise<void> {
    if (this.running) return;
    const coopname = platformSettings().coopname;
    if (!coopname) return;
    this.running = true;
    try {
      await this.remind(coopname, new Date());
    } catch (err: any) {
      this.logger.warn(`Напоминание о закрывающей подписи: прогон упал (${err.message}).`);
    } finally {
      this.running = false;
    }
  }

  async remind(coopname: string, now: Date): Promise<number> {
    const before = new Date(now.getTime() - ISSUANCE_CLOSE_REMINDER_AFTER_MS);
    const sagas = await this.sagaRepo.listAwaitingCloseReminder(coopname, before, REMINDER_BATCH_LIMIT);
    let sent = 0;
    for (const saga of sagas) {
      if (!(await this.sagaRepo.markCloseReminded(saga.id, now))) continue;
      if (await this.send(coopname, saga)) sent++;
    }
    if (sent) this.logger.info(`Напоминание о закрывающей подписи: отправлено ${sent} (coopname=${coopname})`);
    return sent;
  }

  private async send(coopname: string, saga: MarketplaceIssuanceSagaDomainEntity): Promise<boolean> {
    try {
      const fields = (await this.display.enrichByOrderIds([saga.order_id])).get(saga.order_id) ?? {};
      const payload: Workflows.MarketplaceIssuanceCloseReminder.IPayload = {
        operatorName: await this.accountPort.getDisplayName(saga.operator_account),
        memberName: await this.accountPort.getDisplayName(saga.member_account),
        productName: fields.product_name || saga.order_id.slice(0, 8),
        coopname,
        order_id: saga.order_id,
        closeIssuanceOrderId: saga.order_id,
        deepLinkUrl: `${platformSettings().frontendUrl}/${coopname}/market-pvz/issuance`,
      };
      await this.notifications.notifyUser(saga.operator_account, Workflows.MarketplaceIssuanceCloseReminder.id, payload);
      return true;
    } catch (err: any) {
      this.logger.warn(`Напоминание о закрывающей подписи по заказу ${saga.order_id} не отправлено (${err.message}).`);
      return false;
    }
  }
}
