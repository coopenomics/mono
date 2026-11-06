import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { WalletContract } from 'cooptypes';
import { PayoutRequestService } from './payout-request.service';
import type { ActionDomainInterface } from '~/domain/parser/interfaces/action-domain.interface';

const WALLET = WalletContract.contractName.production;
const AUTH_WITHDRAW_EVENT = `action::${WALLET}::${WalletContract.Actions.AuthWithdraw.actionName}`;
const DECLINE_WITHDRAW_EVENT = `action::${WALLET}::${WalletContract.Actions.DeclineWithdraw.actionName}`;

/**
 * Решение совета по заявке на возврат паевого взноса.
 *
 * При подаче (wallet.interactor.ts::createWithdraw) сохраняется заявка на
 * выплату с реквизитами — платежа кассиру до решения совета нет (решение
 * владельца 04.11.2026). Решение совета:
 *
 * - wallet::authwthd — совет разрешил: из заявки создаётся платёж «ожидает»,
 *   кассир видит его и подтверждает выплату;
 * - wallet::declinewthd — совет или шлюз отказали: заявка закрывается, платёж,
 *   если он уже был, отменяется.
 *
 * Платёж, заведённый до заявок в статусе «ожидает решения совета», сервис
 * заявок переводит так же, как раньше.
 */
@Injectable()
export class WithdrawAuthorizationListener {
  private readonly logger = new Logger(WithdrawAuthorizationListener.name);

  constructor(private readonly payoutRequests: PayoutRequestService) {}

  /** Цепь отдаёт checksum256 заглавными, заявка и платёж хранятся строчными. */
  private normalizeHash(raw: string | undefined, actionLabel: string): string | undefined {
    if (!raw) {
      this.logger.warn(`${actionLabel}: в действии нет хэша заявки — пропуск`);
      return undefined;
    }
    return raw.toLowerCase();
  }

  @OnEvent(AUTH_WITHDRAW_EVENT)
  async onAuthWithdraw(action: ActionDomainInterface): Promise<void> {
    // `authwthd` объявлен через AUTHORIZE_CALLBACK_SIGNATURE — хэш заявки лежит
    // в поле `hash`, а не в `withdraw_hash`, как у остальных действий wallet.
    const withdraw_hash = this.normalizeHash(action?.data?.hash as string | undefined, 'authwthd');
    if (!withdraw_hash) return;
    await this.payoutRequests.release(withdraw_hash);
  }

  @OnEvent(DECLINE_WITHDRAW_EVENT)
  async onDeclineWithdraw(action: ActionDomainInterface): Promise<void> {
    const withdraw_hash = this.normalizeHash(action?.data?.withdraw_hash as string | undefined, 'declinewthd');
    if (!withdraw_hash) return;
    await this.payoutRequests.decline(withdraw_hash);
  }
}
