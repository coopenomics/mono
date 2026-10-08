import { Inject, Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Workflows } from '@coopenomics/notifications';
import { AmountFormatterUtils, platformSettings } from '@coopenomics/extension-kit';
import { LOGGER_PORT, NOTIFICATION_PORT, type ILoggerPort, type INotificationPort } from '@coopenomics/innercoop';
import { LOAN_REPOSITORY, type LoanRepository } from '../../domain/repositories/loan.repository';

interface ChainAction {
  account: string;
  name: string;
  data: Record<string, unknown>;
}

/**
 * Уведомления пайщику по шагам займа. Слушаем действия цепи, а не зеркало:
 * действие приходит ровно один раз на событие, а зеркало — на каждое
 * изменение строки.
 */
@Injectable()
export class LoanNotificationsListener {
  constructor(
    @Inject(NOTIFICATION_PORT) private readonly notifications: INotificationPort,
    @Inject(LOAN_REPOSITORY) private readonly loans: LoanRepository,
    @Inject(LOGGER_PORT) private readonly logger: ILoggerPort
  ) {
    this.logger.setContext(LoanNotificationsListener.name);
  }

  @OnEvent('action::debt::loanauth')
  async onAuthorized(action: ChainAction): Promise<void> {
    await this.notify(action, Workflows.LoanDecided.id, { decision: 'authorized' });
  }

  @OnEvent('action::debt::loandecl')
  async onDeclined(action: ChainAction): Promise<void> {
    await this.notify(action, Workflows.LoanDecided.id, { decision: 'declined', reason: String(action.data.reason ?? '') });
  }

  @OnEvent('action::debt::loansgndecl')
  async onSignDeclined(action: ChainAction): Promise<void> {
    await this.notify(action, Workflows.LoanDecided.id, { decision: 'declined', reason: String(action.data.reason ?? '') });
  }

  @OnEvent('action::debt::loansigned')
  async onSigned(action: ChainAction): Promise<void> {
    await this.notify(action, Workflows.LoanSigned.id, {});
  }

  @OnEvent('action::debt::loanpaid')
  async onPaid(action: ChainAction): Promise<void> {
    await this.notify(action, Workflows.LoanIssued.id, {});
  }

  @OnEvent('action::debt::loanpaydecl')
  async onPayDeclined(action: ChainAction): Promise<void> {
    await this.notify(action, Workflows.LoanPaymentDeclined.id, { reason: String(action.data.reason ?? '') });
  }

  private async notify(action: ChainAction, workflowId: string, extra: Record<string, unknown>): Promise<void> {
    const debtHash = String(action.data.debt_hash ?? '').toLowerCase();
    const coopname = String(action.data.coopname ?? '');
    if (!debtHash || !coopname) return;
    try {
      // Запись зеркала могла ещё не дойти: пайщик и сумма есть в ней, а не в
      // обратном вызове. Берём из зеркала, при отсутствии — из данных действия.
      const loan = await this.loans.findByDebtHash(debtHash);
      const username = loan?.username ?? String(action.data.username ?? '');
      if (!username) return;
      const payload = {
        coopName: coopname,
        contractNumber: debtHash.slice(0, 8).toUpperCase(),
        amount: loan?.amount ? AmountFormatterUtils.formatAmountSafe(loan.amount) : '',
        dueAt: loan?.due_at ? loan.due_at.slice(0, 10) : '',
        link: `${platformSettings().frontendUrl}/${coopname}/debt/loans`,
        ...extra,
      };
      await this.notifications.notifyUser(username, workflowId, payload);
    } catch (error: any) {
      this.logger.warn(`Уведомление по займу ${debtHash} (${workflowId}) не отправлено: ${error.message}`);
    }
  }
}
