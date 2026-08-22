/**
 * Общие подписи и идентификаторы шасси расходов (контракт `expense`).
 *
 * Используются доменными виджетами (`shared/ui/domain/ExpenseCreateDialog`,
 * `ExpenseProposalList`) и страницами любых столов, подключающих шасси
 * (Благорост сейчас, кооперативный участок — следующим).
 */
import { Zeus } from '@coopenomics/sdk';

export type ExpenseBadgeVariant =
  | 'neutral'
  | 'pos'
  | 'warn'
  | 'neg'
  | 'info'
  | 'accent';

export function proposalStatusLabel(status: Zeus.ExpenseProposalStatus): string {
  const map: Record<Zeus.ExpenseProposalStatus, string> = {
    [Zeus.ExpenseProposalStatus.CREATED]: 'Создан',
    [Zeus.ExpenseProposalStatus.AUTHORIZED]: 'Авторизован',
    [Zeus.ExpenseProposalStatus.PARTIALLY_PAID]: 'Частично оплачен',
    [Zeus.ExpenseProposalStatus.REPORT_SUBMITTED]: 'Отчёт подан',
    [Zeus.ExpenseProposalStatus.CLOSED]: 'Закрыт',
    [Zeus.ExpenseProposalStatus.DECLINED]: 'Отклонён',
    [Zeus.ExpenseProposalStatus.UNDEFINED]: 'Неизвестно',
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
    ? 'Оплата по счёту'
    : 'Аванс под отчёт';
}

export function itemStatusLabel(
  status: Zeus.ExpenseItemStatus,
  mechanics: Zeus.ExpenseMechanics,
): string {
  switch (status) {
    case Zeus.ExpenseItemStatus.APPROVED:
      return 'Ожидает оплаты';
    case Zeus.ExpenseItemStatus.PAID:
      return mechanics === Zeus.ExpenseMechanics.ADVANCE
        ? 'Аванс выдан — ожидает отчёта'
        : 'Оплачена';
    case Zeus.ExpenseItemStatus.REPORTED:
      return 'Отчёт получен';
    case Zeus.ExpenseItemStatus.RETURNED:
      return 'Аванс возвращён';
    case Zeus.ExpenseItemStatus.OVERSPENT:
      return 'Перерасход';
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
      return 'Чек об оплате';
    case Zeus.ExpenseFileKind.REPORT_FILE:
      return 'Чек';
    case Zeus.ExpenseFileKind.RETURN_PROOF:
      return 'Возврат';
    case Zeus.ExpenseFileKind.CLOSING_DOC:
      return 'Закрывающий документ';
    default:
      return 'Файл';
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
      return 'Требуется отчёт';
    case ExpenseReportState.SETTLEMENT_PENDING:
      return 'Отчёт подан, ждём расчёт';
    case ExpenseReportState.CLOSED:
      return 'Отчёт принят';
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
