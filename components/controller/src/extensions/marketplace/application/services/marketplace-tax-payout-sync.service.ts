import { Inject, Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { BranchContract } from 'cooptypes';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';
import {
  GATEWAY_INTERACTOR_PORT,
  type GatewayInteractorPort,
} from '~/domain/wallet/ports/gateway-interactor.port';
import { PaymentStatusEnum } from '~/domain/gateway/enums/payment-status.enum';
import type { IAction } from '~/types';

/**
 * Слушатель перечисления удержанного НДФЛ в бюджет (requirement b6, решение
 * владельца 2026-08-13).
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
export class MarketplaceTaxPayoutSyncService {
  constructor(
    @Inject(GATEWAY_INTERACTOR_PORT)
    private readonly coreGateway: GatewayInteractorPort,
    private readonly logger: WinstonLoggerService
  ) {
    this.logger.setContext(MarketplaceTaxPayoutSyncService.name);
  }

  @OnEvent(
    `action::${BranchContract.contractName.production}::${BranchContract.Actions.TaxConfirm.actionName}`
  )
  async handleTaxConfirm(action: IAction): Promise<void> {
    await this.applyOutcome(action, PaymentStatusEnum.COMPLETED, 'taxconfirm');
  }

  @OnEvent(
    `action::${BranchContract.contractName.production}::${BranchContract.Actions.TaxDecline.actionName}`
  )
  async handleTaxDecline(action: IAction): Promise<void> {
    await this.applyOutcome(action, PaymentStatusEnum.FAILED, 'taxdecline');
  }

  private async applyOutcome(
    action: IAction,
    status: PaymentStatusEnum,
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
