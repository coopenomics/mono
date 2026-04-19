// Epic 4: интерфейсы ledger2 (process_hash/process_type)

export type IAsset = string
export type IName = string
export type IChecksum256 = string

/**
 * apply-action контракта _ledger2 (Story 4.3).
 * document_hash переименован в process_hash (entity-hash процесса).
 */
export interface IApply {
  coopname: IName
  initiator: IName
  action_code: IName
  amount: IAsset
  username: IName
  process_hash: IChecksum256
  memo: string
}

/**
 * Типы процессов ledger2 (архитектура §4.2).
 * Имя с обязательным контрактным префиксом, ≤ 13 base32-символов.
 */
export type IProcessType =
  | 'reg.regist'
  | 'wall.deposit'
  | 'wall.withdrw'
  | 'cap.capimp'
  | 'cap.debt'
  // Акт 2 результат — один процесс с двумя эффектами (share-вклад результата
  // в паевой и погашение займа из стоимости результата). Под одним process_hash
  // emit'ятся два apply с разными action_code (cap.act2shr + cap.act2ln), но
  // это ОДИН тип процесса. UI показывает оба эффекта раздельно внутри одной
  // карточки — discriminator = action.data.action_code.
  | 'cap.act2res'
  | 'cap.act2prp'
  | 'mkt.offereq'
  | 'sov.axncnv'
  // Epic 1 addendum (2026-04-18): миграционные процессы через apply(OPENING_*)
  | 'mig.opening'
  | 'mig.rid'

/**
 * Сводка процесса (listProcesses).
 */
export interface IProcessSummary {
  processType: IProcessType | string
  processHash: IChecksum256
  coopname: IName
  username: IName | null
  firstSeenAt: string
  lastSeenAt: string
  // actionCount/deltaCount/documentCount удалены: на 100 строк × 3 SQL =
  // 300 запросов на каждый listProcesses. UI читает getProcess(hash) при
  // раскрытии конкретного процесса — там счётчики выводимы из массивов.
}

/**
 * Фильтры листинга processes.
 */
export interface IProcessesFilter {
  coopname: IName
  processType?: IProcessType | string
  username?: IName
  fromBlock?: number
  toBlock?: number
}

/**
 * Полный срез процесса (getProcess).
 */
export interface IProcessAction {
  id: string
  account: string
  name: string
  data: unknown
  block_num: number
  block_id: string
  global_sequence: string
  transaction_id: string
  created_at: string
}

export interface IProcessDelta {
  id: string
  code: string
  scope: string
  table: string
  primary_key: string
  present: boolean
  value: unknown
  block_num: number
  created_at: string
}

export interface IProcessDocument {
  hash: string
  source: { code: string; table: string; field: string; primary_key: string }
  document: unknown
  raw?: unknown
}

export interface IProcessView {
  process_type: IProcessType | string
  process_hash: IChecksum256
  coopname: IName
  first_seen_at: string
  last_seen_at: string
  actions: IProcessAction[]
  delta_history: IProcessDelta[]
  documents: IProcessDocument[]
}
