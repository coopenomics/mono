import type { DraftContract } from 'cooptypes';

/**
 * Запись в контракт шаблонов документов от имени кооператива.
 *
 * Утверждение редакции фиксирует фабрика утверждений после решения совета:
 * кооператив подписывает действие своим ключом из vault, как и публикацию
 * повестки.
 */
export interface DraftBlockchainPort {
  /** Результат транзакции; форма зависит от адаптера цепи, домену нужен только факт успеха. */
  approveDraft(data: DraftContract.Actions.Approve.IApprove): Promise<unknown>;
}

export const DRAFT_BLOCKCHAIN_PORT = Symbol('DraftBlockchainPort');
