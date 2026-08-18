import { Inject, Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { BranchContract } from 'cooptypes';
import {
  LOGGER_PORT,
  PAYMENT_DESK_PORT,
  PaymentStatus,
  type ILoggerPort,
  type IPaymentDeskPort,
  type InnerChainActionRecord,
} from '@coopenomics/innercoop';

/**
 * Слушатель перечисления удержанного налога в бюджет.
 *
 * Живёт на столе бухгалтера рядом с самой отправкой: платёж заводит он, и он
 * же обязан узнать его судьбу. Программа-источник удержания к этому моменту
 * своё дело сделала.
 *
 * `branch::taxconfirm` приходит inline-вызовом из `gateway::outcomplete`,
 * когда кассир подтвердил перевод по реквизитам налоговой — платёж
 * закрывается статусом COMPLETED, а долг перед бюджетом уменьшается на цепи.
 *
 * `branch::taxdecline` приходит, когда кассир не смог заплатить: заявка на
 * цепи стирается, обязательство остаётся в полном объёме, и бухгалтер создаёт
 * платёж заново. Этим налоговый платёж отличается от материальной помощи, где
 * отказ кассира невозможен: там исполняется решение совета, здесь — обычное
 * банковское поручение бухгалтерии.
 *
 * Собственной projection-таблицы нет: `outcome_hash` = `tax_hash`, он же лежит
 * на core-платеже как `hash`, поэтому платёж находится прямым поиском.
 */
@Injectable()
export class WithheldTaxPayoutSyncService {
  constructor(
    @Inject(PAYMENT_DESK_PORT)
    private readonly coreGateway: IPaymentDeskPort,
    @Inject(LOGGER_PORT)
    private readonly logger: ILoggerPort
  ) {
    this.logger.setContext(WithheldTaxPayoutSyncService.name);
  }

  @OnEvent(
    `action::${BranchContract.contractName.production}::${BranchContract.Actions.TaxConfirm.actionName}`
  )
  async handleTaxConfirm(action: InnerChainActionRecord): Promise<void> {
    await this.applyOutcome(action, PaymentStatus.COMPLETED, 'taxconfirm');
  }

  @OnEvent(
    `action::${BranchContract.contractName.production}::${BranchContract.Actions.TaxDecline.actionName}`
  )
  async handleTaxDecline(action: InnerChainActionRecord): Promise<void> {
    await this.applyOutcome(action, PaymentStatus.FAILED, 'taxdecline');
  }

  private async applyOutcome(
    action: InnerChainActionRecord,
    status: PaymentStatus,
    actionLabel: string
  ): Promise<void> {
    try {
      const data = action.data as { coopname?: string; outcome_hash?: string; reason?: string };
      if (!data?.coopname || !data?.outcome_hash) {
        this.logger.warn(`${actionLabel}: пустые coopname/outcome_hash — пропускаю.`);
        return;
      }
      // On-chain hash приходит в верхнем регистре, а payment.hash сохранён
      // так, как его передал createTaxPayment (lowercase) — без нормализации
      // платёж не найдётся.
      const outcomeHash = data.outcome_hash.toLowerCase();
      const found = await this.coreGateway.getPayments(
        { coopname: data.coopname, hash: outcomeHash },
        { page: 1, limit: 1, sortOrder: 'DESC' }
      );
      const payment = found.items[0];
      if (!payment?.id) {
        this.logger.warn(
          `${actionLabel}: core-платёж для outcome ${outcomeHash} не найден — пропускаю.`
        );
        return;
      }
      await this.coreGateway.setPaymentStatus({
        id: payment.id,
        status,
        ...(data.reason ? { message: data.reason } : {}),
      });
    } catch (e: any) {
      this.logger.error(`${actionLabel}: ошибка обработки — ${e.message}`, e.stack);
    }
  }
}
