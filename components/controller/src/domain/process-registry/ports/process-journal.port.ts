import type { ActionDomainInterface } from '~/domain/parser/interfaces/action-domain.interface';
import type { DeltaDomainInterface } from '~/domain/parser/interfaces/delta-domain.interface';
import type { HashLocation } from '../config/process-hash-locator';

/** Окно блоков процесса, в котором ищутся действия с его документами. */
export interface ProcessDocumentActionsQuery {
  hash: string;
  coopname: string;
  fromBlock: number;
  toBlock: number;
  /** Контракт, действия которого в выборку не входят (учётный контракт). */
  excludeAccount: string;
}

/**
 * Журнал цепи глазами реестра процессов: действия и изменения таблиц, связанные
 * одним хэшем процесса.
 */
export interface ProcessJournalPort {
  /** Все действия нитки процесса, по порядку в цепи. */
  findActionsByProcess(hash: string, coopname: string): Promise<ActionDomainInterface[]>;
  /** Изменения сущностной таблицы, в поле которой записан хэш процесса, по порядку блоков. */
  findEntityDeltas(location: HashLocation, hash: string, coopname: string): Promise<DeltaDomainInterface[]>;
  /** Действия вне учётного контракта, в данных которых встречается хэш процесса. */
  findDocumentActions(query: ProcessDocumentActionsQuery): Promise<ActionDomainInterface[]>;
  /** Сводные запросы реестра (счёт и страница процессов) — текст с нумерованными параметрами. */
  query<TRow = Record<string, unknown>>(text: string, parameters: readonly unknown[]): Promise<TRow[]>;
}

export const PROCESS_JOURNAL_PORT = Symbol('ProcessJournalPort');
