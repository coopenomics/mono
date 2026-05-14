/**
 * Бух.проводка ledger2 = пара действий (debit + credit), вызванных одним
 * apply-оркестратором. Парование точечное через метаданные parser2: оба
 * inline имеют одинаковую пару `(transaction_id, creator_action_ordinal)`,
 * указывающую на родительский apply.
 *
 * В multi-effect процессах (тип `p.cap.rid` — два apply под одним processHash)
 * каждое apply даёт свою пару проводок, разделение между ними естественное
 * через разный `creator_action_ordinal`.
 */
export interface Ledger2PostingDomainInterface {
  /** Стабильный ключ для UI: `${debitGlobalSequence}_${creditGlobalSequence ?? '_'}`. */
  key: string;
  blockNum: number;
  processHash: string | null;
  /** OPERATION_REGISTRY код из parent apply (`o.cap.lend` / `o.wal.depcpl` / ...). */
  operationCode: string | null;
  /** global_sequence parent apply'а — для дублирующего отображения и cross-link в реестр операций. */
  parentApplyGlobalSequence: string | null;
  debitGlobalSequence: string | null;
  /** id бух.счёта debit (×1000). */
  debitAccountId: number | null;
  creditGlobalSequence: string | null;
  /** id бух.счёта credit (×1000). */
  creditAccountId: number | null;
  /** Сумма проводки в asset-формате (`"100.0000 RUB"`). */
  quantity: string | null;
  memo: string | null;
  username: string | null;
  createdAt: Date;
}

export interface Ledger2PostingsFilterDomainInterface {
  coopname: string;
  /** id бух.счёта (×1000) — попадание в debit ИЛИ credit. */
  accountId?: number;
  username?: string;
  /** processHash — все проводки одной бизнес-операции. */
  processHash?: string;
  /**
   * № проводки — `debit.global_sequence` ровно одной строки. Парный credit
   * подтягивается точечным JOIN на (transaction_id, creator_action_ordinal).
   */
  debitGlobalSequence?: string;
  /**
   * № операции — `apply.global_sequence`, родитель проводки. Возвращает
   * пары debit+credit ровно одной apply-группы; отличает соседние apply
   * с одинаковым processHash через свой action_ordinal.
   */
  applyGlobalSequence?: string;
  dateFrom?: Date;
  dateTo?: Date;
  page?: number;
  limit?: number;
  sortOrder?: 'ASC' | 'DESC';
}

export interface Ledger2PostingsResponseDomainInterface {
  items: Ledger2PostingDomainInterface[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
}
