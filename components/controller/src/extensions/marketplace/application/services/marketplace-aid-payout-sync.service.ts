import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { BranchContract } from 'cooptypes';
import { LOGGER_PORT, type ILoggerPort, PaymentStatus,
  type InnerChainActionRecord,
} from '@coopenomics/innercoop';
import { formatPayoutDestination } from '../shared/payout-destination.util';
import { MARKETPLACE_AID_PAYOUT_CONFIRMED_EVENT } from '../events/marketplace-notification.events';
import { PAYMENT_METHOD_PORT, type IPaymentMethodPort } from '@coopenomics/innercoop';
import { PAYMENT_DESK_PORT, type IPaymentDeskPort } from '@coopenomics/innercoop';

/**
 * requirement b6 (2026-08-03): слушатель подтверждения выплаты материальной
 * помощи кассиром. `branch::aidconfirm` приходит inline-вызовом из
 * `gateway::outcomplete` после того, как кассир подтвердил фактический
 * банковский перевод — здесь платёж закрывается статусом COMPLETED.
 *
 * Парного отказа нет: одобренную советом выплату отменить нельзя, и
 * `branch::aiddecline` на цепи всегда падает с ошибкой — событие с него не
 * приходит. Отказ до выплаты возможен только решением совета и приходит в
 * `MarketplaceAidCouncilSyncService`.
 *
 * В отличие от `MarketplacePayoutSyncService` (выплата поставщику) здесь НЕТ
 * собственной projection-таблицы: `outcome_hash` = `aid_hash`, который уже
 * лежит на core-платеже как `hash` (проставлен при createSystemOutgoingPayment),
 * поэтому платёж находится прямым поиском `getPayments({ hash })` — заводить
 * ради одного идентификатора отдельную marketplace-таблицу избыточно.
 */
@Injectable()
export class MarketplaceAidPayoutSyncService {
  constructor(
    @Inject(PAYMENT_DESK_PORT)
    private readonly coreGateway: IPaymentDeskPort,
    @Inject(PAYMENT_METHOD_PORT)
    private readonly paymentMethodRepo: IPaymentMethodPort,
    private readonly eventBus: EventEmitter2,
    @Inject(LOGGER_PORT) private readonly logger: ILoggerPort
  ) {
    this.logger.setContext(MarketplaceAidPayoutSyncService.name);
  }

  @OnEvent(
    `action::${BranchContract.contractName.production}::${BranchContract.Actions.AidConfirm.actionName}`
  )
  async handleAidConfirm(action: InnerChainActionRecord): Promise<void> {
    try {
      const data = action.data as { coopname?: string; outcome_hash?: string };
      if (!data?.coopname || !data?.outcome_hash) {
        this.logger.warn('aidconfirm: пустые coopname/outcome_hash — пропускаю.');
        return;
      }
      // On-chain hash приходит в верхнем регистре, а payment.hash в core
      // сохранён в том виде, в котором его передал createAid (lowercase) —
      // нормализуем, иначе поиск платежа не найдёт запись.
      const outcomeHash = data.outcome_hash.toLowerCase();
      const found = await this.coreGateway.getPayments(
        { coopname: data.coopname, hash: outcomeHash },
        { page: 1, limit: 1, sortOrder: 'DESC' }
      );
      const payment = found.items[0];
      if (!payment?.id) {
        this.logger.warn(
          `aidconfirm: core-платёж для outcome ${outcomeHash} не найден — заявка создана до этой доработки? Пропускаю.`
        );
        return;
      }
      await this.coreGateway.setPaymentStatus({
        id: payment.id,
        status: PaymentStatus.COMPLETED,
      });

      // Уведомление — после commit'а статуса (INV-12), не блокирует основной flow.
      let payment_destination: string | null = null;
      if (payment.payment_method_id) {
        try {
          const method = await this.paymentMethodRepo.get({
            username: payment.username,
            method_id: payment.payment_method_id,
          });
          payment_destination = formatPayoutDestination(method);
        } catch {
          // Реквизиты удалены получателем — уведомление уйдёт без них.
        }
      }
      this.eventBus.emit(MARKETPLACE_AID_PAYOUT_CONFIRMED_EVENT, {
        coopname: payment.coopname,
        member_account: payment.username,
        amount: `${payment.quantity} ${payment.symbol}`,
        payment_destination,
      });
    } catch (err: any) {
      this.logger.error(`aidconfirm listener упал: ${err.message}`, err.stack);
    }
  }
}

export const MARKETPLACE_AID_PAYOUT_SYNC_SERVICE = Symbol('MARKETPLACE_AID_PAYOUT_SYNC_SERVICE');
