/**
 * Общие подписи и идентификаторы шасси расходов (контракт `expense`).
 *
 * Используются доменными виджетами (`shared/ui/domain/ExpenseCreateDialog`,
 * `ExpenseProposalList`) и страницами любых столов, подключающих шасси
 * (Благорост сейчас, кооперативный участок — следующим).
 */
import { Zeus } from '@coopenomics/sdk';
import { t } from 'src/shared/i18n';

export type ExpenseBadgeVariant =
  | 'neutral'
  | 'pos'
  | 'warn'
  | 'neg'
  | 'info'
  | 'accent';

export function proposalStatusLabel(status: Zeus.ExpenseProposalStatus): string {
  const map: Record<Zeus.ExpenseProposalStatus, string> = {
    [Zeus.ExpenseProposalStatus.CREATED]: t('payment.expenseProposal.status.created'),
    [Zeus.ExpenseProposalStatus.AUTHORIZED]: t('payment.expenseProposal.status.authorized'),
    [Zeus.ExpenseProposalStatus.PARTIALLY_PAID]: t('payment.expenseProposal.status.partiallyPaid'),
    [Zeus.ExpenseProposalStatus.REPORT_SUBMITTED]: t('payment.expenseProposal.status.reportSubmitted'),
    [Zeus.ExpenseProposalStatus.CLOSED]: t('payment.expenseProposal.status.closed'),
    [Zeus.ExpenseProposalStatus.DECLINED]: t('payment.expenseProposal.status.declined'),
    [Zeus.ExpenseProposalStatus.UNDEFINED]: t('payment.expenseProposal.status.unknown'),
  };
  return map[status] ?? status;
}

export function proposalStatusVariant(
  status: Zeus.ExpenseProposalStatus,
): ExpenseBadgeVariant {
  switch (status) {
    case Zeus.ExpenseProposalStatus.CLOSED:
      return 'pos';
    case Zeus.ExpenseProposalStatus.AUTHORIZED:
      return 'accent';
    case Zeus.ExpenseProposalStatus.PARTIALLY_PAID:
    case Zeus.ExpenseProposalStatus.REPORT_SUBMITTED:
      return 'warn';
    case Zeus.ExpenseProposalStatus.DECLINED:
      return 'neg';
    case Zeus.ExpenseProposalStatus.CREATED:
      return 'info';
    default:
      return 'neutral';
  }
}

export function mechanicsLabel(mechanics: Zeus.ExpenseMechanics): string {
  return mechanics === Zeus.ExpenseMechanics.DIRECT
    ? t('payment.expenseMechanics.kind.direct')
    : t('payment.expenseMechanics.kind.advance');
}

export function itemStatusLabel(
  status: Zeus.ExpenseItemStatus,
  mechanics: Zeus.ExpenseMechanics,
): string {
  switch (status) {
    case Zeus.ExpenseItemStatus.APPROVED:
      return t('payment.expenseItem.status.approved');
    case Zeus.ExpenseItemStatus.PAID:
      return mechanics === Zeus.ExpenseMechanics.ADVANCE
        ? t('payment.expenseItem.status.paidAdvance')
        : t('payment.expenseItem.status.paidDirect');
    case Zeus.ExpenseItemStatus.REPORTED:
      return t('payment.expenseItem.status.reported');
    case Zeus.ExpenseItemStatus.RETURNED:
      return t('payment.expenseItem.status.returned');
    case Zeus.ExpenseItemStatus.OVERSPENT:
      return t('payment.expenseItem.status.overspent');
    default:
      return status;
  }
}

export function itemStatusVariant(
  status: Zeus.ExpenseItemStatus,
): ExpenseBadgeVariant {
  switch (status) {
    case Zeus.ExpenseItemStatus.REPORTED:
      return 'pos';
    case Zeus.ExpenseItemStatus.PAID:
      return 'warn';
    case Zeus.ExpenseItemStatus.APPROVED:
      return 'info';
    case Zeus.ExpenseItemStatus.OVERSPENT:
      return 'neg';
    default:
      return 'neutral';
  }
}

export function fileKindLabel(kind: Zeus.ExpenseFileKind): string {
  switch (kind) {
    case Zeus.ExpenseFileKind.PAYMENT_PROOF:
      return t('payment.expenseFile.kind.paymentProof');
    case Zeus.ExpenseFileKind.REPORT_FILE:
      return t('payment.expenseFile.kind.reportFile');
    case Zeus.ExpenseFileKind.RETURN_PROOF:
      return t('payment.expenseFile.kind.returnProof');
    case Zeus.ExpenseFileKind.CLOSING_DOC:
      return t('payment.expenseFile.kind.closingDoc');
    default:
      return t('payment.expenseFile.kind.default');
  }
}

/**
 * Состояние отчёта по строке-авансу, зеркалится бэкендом в
 * `payment.blockchain_data.report_state`. Строки совпадают с серверным enum
 * `ExpenseReportState` (controller/extensions/expenses/domain/enums) — поле живёт
 * в JSON-скаляре blockchain_data, а не в типизированной GraphQL-схеме.
 */
export enum ExpenseReportState {
  NOT_REQUIRED = 'NOT_REQUIRED',
  AWAITING = 'AWAITING',
  SETTLEMENT_PENDING = 'SETTLEMENT_PENDING',
  CLOSED = 'CLOSED',
}

export function reportStateLabel(state: ExpenseReportState): string {
  switch (state) {
    case ExpenseReportState.AWAITING:
      return t('payment.expenseReport.state.awaiting');
    case ExpenseReportState.SETTLEMENT_PENDING:
      return t('payment.expenseReport.state.settlementPending');
    case ExpenseReportState.CLOSED:
      return t('payment.expenseReport.state.closed');
    default:
      return '';
  }
}

export function reportStateVariant(state: ExpenseReportState): ExpenseBadgeVariant {
  switch (state) {
    case ExpenseReportState.CLOSED:
      return 'pos';
    case ExpenseReportState.SETTLEMENT_PENDING:
      return 'info';
    case ExpenseReportState.AWAITING:
      return 'warn';
    default:
      return 'neutral';
  }
}

// Короткий идентификатор СЗ — как № в документе (первые 16 символов хэша).
export function shortExpenseId(hash: string): string {
  return hash.slice(0, 16).toUpperCase();
}
