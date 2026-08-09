import type { TransactResult } from '@wharfkit/session';
import type {
  ApproveKuTrustedInputDomainInterface,
  CancelKuDecisionInputDomainInterface,
  CloseKuDecisionInputDomainInterface,
  CreateKuDecisionInputDomainInterface,
  DeclineKuTrustedInputDomainInterface,
  ExecKuDecisionInputDomainInterface,
  JoinKuDecisionInputDomainInterface,
  RequestKuTrustedInputDomainInterface,
  StartKuDecisionInputDomainInterface,
  VoteOnKuDecisionInputDomainInterface,
} from './ku-action-inputs.interface';

/**
 * Блокчейн-порт собраний и решений кооперативных участков (контракт branch).
 * Все действия подписываются ключом кооператива.
 */
export interface KuBlockchainPort {
  /** Объявление собрания пайщиков участка */
  createDecision(data: CreateKuDecisionInputDomainInterface): Promise<TransactResult>;

  /** Присоединение пайщика к собранию */
  joinDecision(data: JoinKuDecisionInputDomainInterface): Promise<TransactResult>;

  /** Назначение председателя собрания */

  /** Открытие голосования */
  startDecision(data: StartKuDecisionInputDomainInterface): Promise<TransactResult>;

  /** Подача бюллетеня участником */
  voteOnDecision(data: VoteOnKuDecisionInputDomainInterface): Promise<TransactResult>;

  /** Закрытие голосования и утверждение протокола председателем */
  closeDecision(data: CloseKuDecisionInputDomainInterface): Promise<TransactResult>;

  /** Направление заявления председателя в совет (учреждение участка) */
  execDecision(data: ExecKuDecisionInputDomainInterface): Promise<TransactResult>;

  /** Отмена собрания инициатором */
  cancelDecision(data: CancelKuDecisionInputDomainInterface): Promise<TransactResult>;

  /** Подача заявки доверенного лица участка */
  requestTrusted(data: RequestKuTrustedInputDomainInterface): Promise<TransactResult>;

  /** Одобрение заявки доверенного встречной подписью председателя участка */
  approveTrusted(data: ApproveKuTrustedInputDomainInterface): Promise<TransactResult>;

  /** Отклонение заявки доверенного */
  declineTrusted(data: DeclineKuTrustedInputDomainInterface): Promise<TransactResult>;
}

export const KU_BLOCKCHAIN_PORT = Symbol('KuBlockchainPort');
