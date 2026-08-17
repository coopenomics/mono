/**
 * Ledger2 (ядро): read-only контракт истории операций/движений по кошельку
 * из журнала `blockchain_actions`. Реализация — адаптер над `Ledger2Service`
 * в ядре контроллера (`application/ledger2`); токен `LEDGER2_HISTORY_PORT`
 * регистрируется в `InnercoopBridgeModule`.
 *
 * Ядро ledger2 не знает доменных понятий consumer-extension'ов (КУ, проект,
 * программа) — авторизацию (кто вправе смотреть историю ЭТОГО кошелька)
 * обязан делать сам consumer ДО вызова порта, на своих доменных данных
 * (например marketplace проверяет `isMemberOfBranch` перед чтением
 * `w.brn.common`). Порт отдаёт то, что попросили, без скоупинга.
 */

/** Одна запись журнала — apply (несёт operationCode) либо walletop/debit/credit (без него). */
export interface InnerLedger2Operation {
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

export interface InnerLedger2HistoryFilter {
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

export interface InnerLedger2HistoryResult {
  items: InnerLedger2Operation[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
}

/**
 * Счёт плана счетов кооператива с текущим сальдо.
 *
 * Суммы — строки с символом токена, как в цепи: разбирать их числом нельзя,
 * точность зависит от токена.
 */
export interface InnerLedger2Account {
  /** Номер счёта по плану: 51000, 80000, 86000 и далее. */
  id: number;
  /** Название счёта по-русски. */
  name: string;
  balance: string;
  debitBalance: string;
  creditBalance: string;
  [key: string]: any;
}

export interface ILedger2HistoryPort {
  getHistory(filter: InnerLedger2HistoryFilter): Promise<InnerLedger2HistoryResult>;

  /**
   * План счетов кооператива с сальдо.
   *
   * На один номер счёта может прийти несколько записей — по субсчетам и
   * валютам; потребитель, которому нужен итог, суммирует их сам.
   */
  getAccounts(coopname: string): Promise<InnerLedger2Account[]>;
}

// ─── DI-токен ──────────────────────────────────────────────────────────────────

/**
 * Ledger2 (ядро): read-only история операций/движений по кошельку из blockchain_actions.
 * Реализацию подставляет composition root (`InnercoopBridgeModule`).
 */
export const LEDGER2_HISTORY_PORT = Symbol.for('Innercoop.CorePort.Ledger2History');
