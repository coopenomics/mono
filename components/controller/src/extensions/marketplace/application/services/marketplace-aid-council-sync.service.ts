import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { BranchContract } from 'cooptypes';
import { LOGGER_PORT, type ILoggerPort, PaymentStatus, InnerPayoutRequestStatus,
  type InnerChainActionRecord,
} from '@coopenomics/innercoop';
import { MARKETPLACE_AID_COUNCIL_DECIDED_EVENT } from '../events/marketplace-notification.events';
import { PAYMENT_DESK_PORT, type IPaymentDeskPort } from '@coopenomics/innercoop';
import { t } from '../../i18n';

/**
 * Слушатель решений совета по заявлению на материальную помощь (p.brn.aid).
 *
 * Выплата денег из кооператива — компетенция совета, поэтому `createAid`
 * сохраняет заявку на выплату с реквизитами (платежа кассиру ещё нет) и вносит
 * заявление на повестку. Решение совета приходит одним из callback'ов
 * контракта branch:
 *   - `onaidauth` — совет одобрил: из заявки создаётся платёж «ожидает», и он
 *     появляется у кассира в реестре исходящих;
 *   - `onaiddecl` — совет отказал (или повестка просрочена): заявка
 *     закрывается, средства остаются на персональном кошельке получателя.
 *
 * Тот же порядок, что у возврата паевого взноса (WithdrawAuthorizationListener):
 * заявка и платёж ищутся по `hash`, равному `aid_hash`.
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
  async handleCouncilAuthorized(action: InnerChainActionRecord): Promise<void> {
    await this.applyDecision(action, true, 'onaidauth');
  }

  @OnEvent(
    `action::${BranchContract.contractName.production}::${BranchContract.Actions.OnAidDecl.actionName}`
  )
  async handleCouncilDeclined(action: InnerChainActionRecord): Promise<void> {
    await this.applyDecision(action, false, 'onaiddecl');
  }

  private async applyDecision(
    action: InnerChainActionRecord,
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
      const subject = await this.decisionSubject(data.coopname, aidHash);
      if (!subject) {
        // Повторный или поздний callback по уже решённому заявлению ничего не меняет.
        this.logger.debug(`${actionLabel}: заявление ${aidHash} уже решено либо не найдено — пропускаю.`);
        return;
      }

      if (approved) {
        // Совет разрешил: платёж кассиру создаётся из заявки только сейчас.
        const payment = await this.coreGateway.releasePayoutRequest(aidHash);
        if (!payment) {
          this.logger.warn(`${actionLabel}: платёж по заявлению ${aidHash} не создан — заявка не найдена.`);
          return;
        }
      } else {
        await this.coreGateway.declinePayoutRequest(aidHash);
      }

      this.eventBus.emit(MARKETPLACE_AID_COUNCIL_DECIDED_EVENT, {
        coopname: subject.coopname,
        member_account: subject.username,
        amount: `${subject.quantity} ${subject.symbol}`,
        approved,
        reason: approved ? undefined : (data.reason ?? t('marketplace.aidCouncilSync.rejectedReasonLabel')),
      });
    } catch (err: any) {
      this.logger.error(`${actionLabel} listener упал: ${err.message}`, err.stack);
    }
  }

  /**
   * Что решает совет: заявка, которая ждёт решения, либо платёж «ожидает решения
   * совета», заведённый до заявок. Решённое — null.
   */
  private async decisionSubject(
    coopname: string,
    aidHash: string
  ): Promise<{ coopname: string; username: string; quantity: number; symbol: string } | null> {
    const request = await this.coreGateway.getPayoutRequest(aidHash);
    if (request) return request.status === InnerPayoutRequestStatus.AWAITING ? request : null;
    const found = await this.coreGateway.getPayments({ coopname, hash: aidHash }, { page: 1, limit: 1, sortOrder: 'DESC' });
    const payment = found.items[0];
    return payment?.status === PaymentStatus.AWAITING_AUTHORIZATION ? payment : null;
  }
}

export const MARKETPLACE_AID_COUNCIL_SYNC_SERVICE = Symbol('MARKETPLACE_AID_COUNCIL_SYNC_SERVICE');
