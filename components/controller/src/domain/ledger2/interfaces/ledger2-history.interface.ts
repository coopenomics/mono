/**
 * Операция ledger2 — одна запись из `blockchain_actions WHERE account='ledger2'`.
 *
 * Ledger2 пишет трио действий на каждую проводку: `apply` (метаинформация
 * процесса), `walletop` (движение по кошельку), `debit`/`credit` (проводка).
 * Для журнала операций показываем все — пользователь может фильтровать
 * по action_code / кошельку / диапазону дат.
 */
export interface Ledger2OperationDomainInterface {
  globalSequence: number;
  blockNum: number;
  coopname: string;
  /** `apply` | `walletop` | `debit` | `credit` */
  action: string;
  /** Для `apply`: ACTION_REGISTRY code (cap.debt / wall.deposit / mig.opening / ...). */
  actionCode: string | null;
  processHash: string | null;
  /** Кто инициировал действие; для mig.* может быть null. */
  username: string | null;
  /** Для walletop/debit/credit — id счёта/кошелька (×1000 offset). */
  accountId: number | null;
  /** Сумма в формате asset (`"100.0000 RUB"`) — применимо к walletop/debit/credit. */
  quantity: string | null;
  memo: string | null;
  createdAt: Date;
}

export interface Ledger2HistoryFilterDomainInterface {
  coopname: string;
  /** Фильтр по конкретному счёту/кошельку (×1000 offset). */
  accountId?: number;
  /** Одно из имён действий `apply|walletop|debit|credit`. Пусто = все. */
  actionNames?: string[];
  /** Код процесса из ACTION_REGISTRY (только для `apply`). */
  actionCodes?: string[];
  username?: string;
  dateFrom?: Date;
  dateTo?: Date;
  page?: number;
  limit?: number;
  sortOrder?: 'ASC' | 'DESC';
}

export interface Ledger2HistoryResponseDomainInterface {
  items: Ledger2OperationDomainInterface[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
}
