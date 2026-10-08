import { Inject, Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Workflows } from '@coopenomics/notifications';
import { AmountFormatterUtils, platformSettings } from '@coopenomics/extension-kit';
import {
  CHAIN_PORT,
  LOGGER_PORT,
  NOTIFICATION_PORT,
  type IChainPort,
  type ILoggerPort,
  type INotificationPort,
} from '@coopenomics/innercoop';

interface ChainAction {
  data: Record<string, unknown>;
}

interface ChainDebtRow {
  username: string;
  debt_hash: string;
  amount: string;
  repaid_at: string;
}

/**
 * Уведомления пайщику по шагам займа под коммиты (Генерация) — те же сценарии,
 * что у займа под паевой взнос: решение совета, подпись договора, выдача,
 * отказ платежа. Слушаются действия цепи: действие приходит один раз на событие.
 */
@Injectable()
export class CapitalDebtNotificationsListener {
  constructor(
    @Inject(NOTIFICATION_PORT) private readonly notifications: INotificationPort,
    @Inject(CHAIN_PORT) private readonly chain: IChainPort,
    @Inject(LOGGER_PORT) private readonly logger: ILoggerPort
  ) {
    this.logger.setContext(CapitalDebtNotificationsListener.name);
  }

  @OnEvent('action::capital::debtauthcnfr')
  async onAuthorized(action: ChainAction): Promise<void> {
    await this.notify(action, Workflows.LoanDecided.id, { decision: 'authorized' });
  }

  @OnEvent('action::capital::declinedebt')
  async onDeclined(action: ChainAction): Promise<void> {
    await this.notify(action, Workflows.LoanDecided.id, { decision: 'declined', reason: String(action.data.reason ?? '') });
  }

  @OnEvent('action::capital::debtsigned')
  async onSigned(action: ChainAction): Promise<void> {
    await this.notify(action, Workflows.LoanSigned.id, {});
  }

  @OnEvent('action::capital::debtpaycnfrm')
  async onPaid(action: ChainAction): Promise<void> {
    await this.notify(action, Workflows.LoanIssued.id, {});
  }

  @OnEvent('action::capital::debtpaydcln')
  async onPayDeclined(action: ChainAction): Promise<void> {
    await this.notify(action, Workflows.LoanPaymentDeclined.id, { reason: String(action.data.reason ?? '') });
  }

  private async notify(action: ChainAction, workflowId: string, extra: Record<string, string>): Promise<void> {
    const coopname = String(action.data.coopname ?? '');
    const debtHash = String(action.data.debt_hash ?? '').toLowerCase();
    if (!coopname || !debtHash) return;
    try {
      // Отклонённый заём из цепи уже удалён — имя пайщика есть в данных действия.
      const debt = await this.chainDebt(coopname, debtHash);
      const username = debt?.username ?? String(action.data.username ?? '');
      if (!username) return;
      await this.notifications.notifyUser(username, workflowId, { ...this.payloadOf(coopname, debtHash, debt), ...extra });
    } catch (error: any) {
      this.logger.warn(`Уведомление по займу ${debtHash} (${workflowId}) не отправлено: ${error.message}`);
    }
  }

  private payloadOf(coopname: string, debtHash: string, debt?: ChainDebtRow): Record<string, string> {
    return {
      coopName: coopname,
      contractNumber: debtHash.slice(0, 8).toUpperCase(),
      amount: debt ? AmountFormatterUtils.formatAmountSafe(debt.amount) : '',
      dueAt: debt ? String(debt.repaid_at).slice(0, 10) : '',
      link: `${platformSettings().frontendUrl}/${coopname}/debt/loans`,
    };
  }

  private async chainDebt(coopname: string, debtHash: string): Promise<ChainDebtRow | undefined> {
    const rows = await this.chain.getAllRows<ChainDebtRow>('capital', coopname, 'debts');
    return rows.find((row) => String(row.debt_hash).toLowerCase() === debtHash);
  }
}
