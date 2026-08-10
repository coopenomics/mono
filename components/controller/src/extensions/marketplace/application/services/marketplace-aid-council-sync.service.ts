import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { BranchContract } from 'cooptypes';
import { LOGGER_PORT, type ILoggerPort, PaymentStatus } from '@coopenomics/innercoop';
import { MARKETPLACE_AID_COUNCIL_DECIDED_EVENT } from '../events/marketplace-notification.events';
import type { IAction } from '~/types';
import { PAYMENT_DESK_PORT, type IPaymentDeskPort } from '@coopenomics/innercoop';

/**
 * Слушатель решений совета по заявлению на материальную помощь (p.brn.aid).
 *
 * Выплата денег из кооператива — компетенция совета, поэтому `createAid`
 * создаёт core-платёж скрытым от кассира (AWAITING_AUTHORIZATION) и вносит
 * заявление на повестку. Решение совета приходит одним из callback'ов
 * контракта branch:
 *   - `onaidauth` — совет одобрил: платёж переводится в PENDING и появляется
 *     у кассира в реестре исходящих;
 *   - `onaiddecl` — совет отказал (или повестка просрочена): платёж
 *     отменяется, средства остаются на персональном кошельке получателя.
 *
 * Тот же приём, что и у возврата паевого взноса (WithdrawAuthorizationListener):
 * платёж ищется по `hash`, равному `aid_hash`.
 */
@Injectable()
export class MarketplaceAidCouncilSyncService {
  constructor(
    @Inject(PAYMENT_DESK_PORT)
    private readonly coreGateway: IPaymentDeskPort,
    private readonly eventBus: EventEmitter2,
    @Inject(LOGGER_PORT) private readonly logger: ILoggerPort
  ) {
    this.logger.setContext(MarketplaceAidCouncilSyncService.name);
  }

  @OnEvent(
    `action::${BranchContract.contractName.production}::${BranchContract.Actions.OnAidAuth.actionName}`
  )
  async handleCouncilAuthorized(action: IAction): Promise<void> {
    await this.applyDecision(action, true, 'onaidauth');
  }

  @OnEvent(
    `action::${BranchContract.contractName.production}::${BranchContract.Actions.OnAidDecl.actionName}`
  )
  async handleCouncilDeclined(action: IAction): Promise<void> {
    await this.applyDecision(action, false, 'onaiddecl');
  }

  private async applyDecision(
    action: IAction,
    approved: boolean,
    actionLabel: string
  ): Promise<void> {
    try {
      const data = action.data as { coopname?: string; hash?: string; reason?: string };
      if (!data?.coopname || !data?.hash) {
        this.logger.warn(`${actionLabel}: пустые coopname/hash — пропускаю.`);
        return;
      }
      const aidHash = data.hash.toLowerCase();
      const found = await this.coreGateway.getPayments(
        { coopname: data.coopname, hash: aidHash },
        { page: 1, limit: 1, sortOrder: 'DESC' }
      );
      const payment = found.items[0];
      if (!payment?.id) {
        this.logger.warn(
          `${actionLabel}: платёж заявления ${aidHash} не найден — пропускаю.`
        );
        return;
      }
      // Идемпотентность: решение применяем только к платежу, который ещё ждёт
      // совета. Повторный или поздний callback ничего не меняет.
      if (payment.status !== PaymentStatus.AWAITING_AUTHORIZATION) {
        this.logger.debug(
          `${actionLabel}: платёж ${payment.id} уже в статусе ${payment.status} — решение не применяю.`
        );
        return;
      }

      await this.coreGateway.setPaymentStatus({
        id: payment.id,
        status: approved ? PaymentStatus.PENDING : PaymentStatus.CANCELLED,
        message: approved ? undefined : (data.reason ?? 'Совет отказал в выплате'),
      });

      this.eventBus.emit(MARKETPLACE_AID_COUNCIL_DECIDED_EVENT, {
        coopname: payment.coopname,
        member_account: payment.username,
        amount: `${payment.quantity} ${payment.symbol}`,
        approved,
        reason: approved ? undefined : data.reason,
      });
    } catch (err: any) {
      this.logger.error(`${actionLabel} listener упал: ${err.message}`, err.stack);
    }
  }
}

export const MARKETPLACE_AID_COUNCIL_SYNC_SERVICE = Symbol('MARKETPLACE_AID_COUNCIL_SYNC_SERVICE');
