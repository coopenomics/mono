import { Inject, Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Workflows } from '@coopenomics/notifications';
import { AmountFormatterUtils, platformSettings } from '@coopenomics/extension-kit';
import { LOGGER_PORT, NOTIFICATION_PORT, type ILoggerPort, type INotificationPort } from '@coopenomics/innercoop';
import { LOAN_REPOSITORY, type LoanRepository } from '../../domain/repositories/loan.repository';
import { LoanStatus } from '../../domain/enums/loan-status.enum';
import type { LoanDomainEntity } from '../../domain/entities/loan.entity';
import { LOAN_SYNCED_EVENT, type LoanSyncedPayload } from '../syncers/loan-sync.service';

interface ChainAction {
  account: string;
  name: string;
  data: Record<string, unknown>;
  global_sequence?: string | number;
}

/** Операции книги учёта, по которым пайщик узнаёт о возврате и о списании. */
const OPERATION_REPAY = 'o.dbt.repay';
const OPERATION_SEIZE = 'o.cap.seize';

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

  @OnEvent('action::debt::loanextok')
  async onExtended(action: ChainAction): Promise<void> {
    await this.notify(action, Workflows.LoanExtensionDecided.id, { decision: 'approved' });
  }

  @OnEvent('action::debt::loanextdecl')
  async onExtensionDeclined(action: ChainAction): Promise<void> {
    await this.notify(action, Workflows.LoanExtensionDecided.id, { decision: 'declined', reason: String(action.data.reason ?? '') });
  }

  /**
   * Возврат и обращение обеспечения видны по операциям книги учёта: строка
   * займа при закрытии удаляется одинаково в обоих случаях, а операция
   * называет, что произошло. Хэш процесса операции — хэш займа.
   */
  @OnEvent('action::ledger2::apply')
  async onLedgerOperation(action: ChainAction): Promise<void> {
    const operation = String(action.data.operation_code ?? '');
    if (operation !== OPERATION_REPAY && operation !== OPERATION_SEIZE) return;
    const debtHash = String(action.data.process_hash ?? '').toLowerCase();
    const scoped: ChainAction = { ...action, data: { ...action.data, debt_hash: debtHash } };
    const operationAmount = AmountFormatterUtils.formatAmountSafe(String(action.data.amount ?? ''));
    // Номер события отличает два одинаковых частичных возврата.
    const eventId = String(action.global_sequence ?? '');
    if (operation === OPERATION_REPAY) {
      await this.notify(scoped, Workflows.LoanRepaid.id, { repaid: operationAmount, eventId });
    } else {
      await this.notify(scoped, Workflows.LoanWrittenOff.id, { seized: operationAmount, eventId });
    }
  }

  /** Переход в просрочку: зеркало получило состояние «просрочен». Повтор гасит центр уведомлений. */
  @OnEvent(LOAN_SYNCED_EVENT)
  async onLoanSynced(payload: LoanSyncedPayload): Promise<void> {
    const { entity } = payload;
    if (entity.status !== LoanStatus.OVERDUE || !entity.username) return;
    try {
      await this.notifications.notifyUser(entity.username, Workflows.LoanOverdue.id, {
        coopName: entity.coopname,
        contractNumber: entity.debt_hash.slice(0, 8).toUpperCase(),
        amount: AmountFormatterUtils.formatAmountSafe(String(entity.remaining ?? entity.amount ?? '')),
        dueAt: String(entity.due_at ?? '').slice(0, 10),
        link: `${platformSettings().frontendUrl}/${entity.coopname}/debt/loans`,
        kind: entity.isOwn ? 'share' : 'generation',
      });
    } catch (error: any) {
      this.logger.warn(`Уведомление о просрочке по займу ${entity.debt_hash} не отправлено: ${error.message}`);
    }
  }

  private async notify(action: ChainAction, workflowId: string, extra: Record<string, unknown>): Promise<void> {
    const debtHash = String(action.data.debt_hash ?? '').toLowerCase();
    const coopname = String(action.data.coopname ?? '');
    if (!debtHash || !coopname) return;
    try {
      // Пайщик и сумма есть в записи зеркала, а не в обратном вызове; пока
      // запись не дошла, имя берётся из данных действия.
      const loan = await this.loans.findByDebtHash(debtHash);
      const username = loan?.username ?? String(action.data.username ?? '');
      if (!username) return;
      await this.notifications.notifyUser(username, workflowId, { ...this.payloadOf(coopname, debtHash, loan), ...extra });
    } catch (error: any) {
      this.logger.warn(`Уведомление по займу ${debtHash} (${workflowId}) не отправлено: ${error.message}`);
    }
  }

  private payloadOf(coopname: string, debtHash: string, loan: LoanDomainEntity | null): Record<string, string> {
    return {
      coopName: coopname,
      contractNumber: debtHash.slice(0, 8).toUpperCase(),
      amount: loan?.amount ? AmountFormatterUtils.formatAmountSafe(loan.amount) : '',
      dueAt: loan?.due_at ? loan.due_at.slice(0, 10) : '',
      link: `${platformSettings().frontendUrl}/${coopname}/debt/loans`,
    };
  }
}
