/**
 * Операция ledger2 — одна запись из `blockchain_actions WHERE account='ledger2'`.
 *
 * Ledger2 пишет трио действий на каждую проводку: `apply` (метаинформация
 * процесса), `walletop` (движение по кошельку), `debit`/`credit` (проводка).
 * Для журнала операций показываем все — пользователь может фильтровать
 * по operation_code / кошельку / диапазону дат.
 */
export interface Ledger2OperationDomainInterface {
  globalSequence: number;
  blockNum: number;
  coopname: string;
  /** `apply` | `walletop` | `debit` | `credit` */
  action: string;
  /** Для `apply`: OPERATION_REGISTRY code (o.cap.lend / o.wal.depcpl / o.mig.minshr / ...). */
  operationCode: string | null;
  processHash: string | null;
  /** Кто инициировал действие; для миграции может быть null. */
  username: string | null;
  /** Для debit/credit — id бух.счёта (×1000 offset, например 51000/80000). null для walletop/apply. */
  accountId: number | null;
  /** Для walletop — wallet_from (eosio::name `w.<contract>.<waltype>`). */
  walletFrom: string | null;
  /** Для walletop — wallet_to (eosio::name `w.<contract>.<waltype>`). */
  walletTo: string | null;
  /** Сумма в формате asset (`"100.0000 RUB"`) — применимо к walletop/debit/credit. */
  quantity: string | null;
  memo: string | null;
  createdAt: Date;
}

export interface Ledger2HistoryFilterDomainInterface {
  coopname: string;
  /** Фильтр по бух.счёту (×1000 offset, например 51000/80000) — для debit/credit. */
  accountId?: number;
  /** Фильтр по eosio::name кошелька (`w.<contract>.<waltype>`) — для walletop. */
  walletName?: string;
  /** Одно из имён действий `apply|walletop|debit|credit`. Пусто = все. */
  actionNames?: string[];
  /** Код операции из OPERATION_REGISTRY (только для `apply`). */
  operationCodes?: string[];
  username?: string;
  /** Хэш процесса — позволяет выбрать все действия одной бизнес-операции. */
  processHash?: string;
  /**
   * global_sequence родительского apply. При наличии — возвращаем только
   * siblings (walletop/debit/credit), лежащие в диапазоне
   * (parentApplyGlobalSequence, nextApplySeqInSameProcess) — чтобы
   * раскрытый apply давал ровно своё трио, а не сибсы соседних apply
   * того же processHash (multi-effect процессы типа cap.act2res).
   */
  parentApplyGlobalSequence?: string;
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
