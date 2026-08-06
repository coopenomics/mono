/**
 * Ledger2 (ядро): read-only контракт истории операций/движений по кошельку
 * из журнала `blockchain_actions`. Реализация — адаптер над `Ledger2Service`
 * в ядре контроллера (`application/ledger2`); токен `INTER_LEDGER2_HISTORY`
 * регистрируется в `InterCommunicationBridgeModule`.
 *
 * Ядро ledger2 не знает доменных понятий consumer-extension'ов (КУ, проект,
 * программа) — авторизацию (кто вправе смотреть историю ЭТОГО кошелька)
 * обязан делать сам consumer ДО вызова порта, на своих доменных данных
 * (например marketplace проверяет `isMemberOfBranch` перед чтением
 * `w.brn.common`). Порт отдаёт то, что попросили, без скоупинга.
 */

/** Одна запись журнала — apply (несёт operationCode) либо walletop/debit/credit (без него). */
export interface InterLedger2Operation {
  /** global_sequence блокчейна (строка — значения до 2^53 переполняют number). */
  globalSequence: string;
  blockNum: number;
  coopname: string;
  /** apply | walletop | debit | credit. */
  action: string;
  /** Для apply: код из OPERATION_REGISTRY (o.brn.common / o.wal.depcpl / ...). */
  operationCode?: string | null;
  processHash?: string | null;
  username?: string | null;
  /** ID счёта/кошелька (×1000). */
  accountId?: number | null;
  /** walletop: кошелёк-источник (eosio::name w.<contract>.<waltype>). */
  walletFrom?: string | null;
  /** walletop: кошелёк-получатель (eosio::name w.<contract>.<waltype>). */
  walletTo?: string | null;
  /** Asset-строка, например «100.0000 RUB». */
  quantity?: string | null;
  memo?: string | null;
  /** global_sequence родительского apply — для точечного cross-link на операцию. */
  parentApplyGlobalSequence?: string | null;
  createdAt: Date;
}

export interface InterLedger2HistoryFilter {
  coopname: string;
  /** Бух.счёт (×1000). */
  accountId?: number;
  /** eosio::name кошелька (`w.<contract>.<waltype>`) — для walletop-действий. */
  walletName?: string;
  /** Имена blockchain-действий: apply | walletop | debit | credit. */
  actionNames?: string[];
  /** OPERATION_REGISTRY коды: o.brn.common, o.cap.lend и т.д. */
  operationCodes?: string[];
  username?: string;
  processHash?: string;
  /** global_sequence родительского apply — только inline-сиблинги этого apply. */
  parentApplyGlobalSequence?: string;
  /** № операции = apply.global_sequence. */
  applyGlobalSequence?: string;
  /** № движения по кошельку = walletop.global_sequence. */
  walletopGlobalSequence?: string;
  dateFrom?: Date;
  dateTo?: Date;
  page?: number;
  limit?: number;
  sortOrder?: 'ASC' | 'DESC';
}

export interface InterLedger2HistoryResult {
  items: InterLedger2Operation[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
}

export interface InterLedger2HistoryPort {
  getHistory(filter: InterLedger2HistoryFilter): Promise<InterLedger2HistoryResult>;
}
