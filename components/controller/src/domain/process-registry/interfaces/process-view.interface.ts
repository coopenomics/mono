import type { ExtendedSignedDocumentDomainInterface } from '~/domain/document/interfaces/extended-signed-document-domain.interface';
import type { DocumentDomainEntity } from '~/domain/document/entity/document-domain.entity';

/**
 * Полный снимок процесса ledger2 по process_hash.
 * См. architecture.md §4.7.
 */
export interface ProcessActionView {
  id: string;
  account: string;
  name: string;
  data: unknown;
  block_num: number;
  block_id: string;
  global_sequence: string;
  transaction_id: string;
  created_at: Date;
}

export interface ProcessDeltaView {
  id: string;
  code: string;
  scope: string;
  table: string;
  primary_key: string;
  present: boolean;
  value: unknown;
  block_num: number;
  created_at: Date;
}

export interface ProcessDocumentView {
  hash: string;
  source: { code: string; table: string; field: string; primary_key: string };
  document: ExtendedSignedDocumentDomainInterface;
  raw?: DocumentDomainEntity | null;
}

export interface ProcessView {
  process_type: string;
  process_hash: string;
  coopname: string;
  first_seen_at: Date;
  last_seen_at: Date;
  actions: ProcessActionView[];
  delta_history: ProcessDeltaView[];
  documents: ProcessDocumentView[];
}

/**
 * Сводка процесса для листинга `processes`.
 *
 * Поля actionCount/deltaCount/documentCount удалены: на 100 строк × 3 SQL
 * = 300 запросов на каждый listProcesses → connection pool exhaustion под
 * нагрузкой. UI запрашивает getProcess(hash) при раскрытии конкретного
 * процесса — там счётчики выводимы через `actions.length` / `delta_history.length`
 * / `documents.length`.
 */
export interface ProcessSummary {
  processType: string;
  processHash: string;
  coopname: string;
  username: string | null;
  firstSeenAt: Date;
  lastSeenAt: Date;
}

/**
 * Фильтры для листинга `processes`.
 */
export interface ProcessesFilter {
  coopname: string;
  processType?: string;
  username?: string;
  fromBlock?: number;
  toBlock?: number;
}
