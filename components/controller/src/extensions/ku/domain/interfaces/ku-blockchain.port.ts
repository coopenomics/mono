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
import type { InnerTransactResult } from '@coopenomics/innercoop';

/**
 * Блокчейн-порт собраний и решений кооперативных участков (контракт branch).
 * Все действия подписываются ключом кооператива.
 */
export interface KuBlockchainPort {
  /** Объявление собрания пайщиков участка */
  createDecision(data: CreateKuDecisionInputDomainInterface): Promise<InnerTransactResult>;

  /** Присоединение пайщика к собранию */
  joinDecision(data: JoinKuDecisionInputDomainInterface): Promise<InnerTransactResult>;

  /** Назначение председателя собрания */

  /** Открытие голосования */
  startDecision(data: StartKuDecisionInputDomainInterface): Promise<InnerTransactResult>;

  /** Подача бюллетеня участником */
  voteOnDecision(data: VoteOnKuDecisionInputDomainInterface): Promise<InnerTransactResult>;

  /** Закрытие голосования и утверждение протокола председателем */
  closeDecision(data: CloseKuDecisionInputDomainInterface): Promise<InnerTransactResult>;

  /** Направление заявления председателя в совет (учреждение участка) */
  execDecision(data: ExecKuDecisionInputDomainInterface): Promise<InnerTransactResult>;

  /** Отмена собрания инициатором */
  cancelDecision(data: CancelKuDecisionInputDomainInterface): Promise<InnerTransactResult>;

  /** Подача заявки доверенного лица участка */
  requestTrusted(data: RequestKuTrustedInputDomainInterface): Promise<InnerTransactResult>;

  /** Одобрение заявки доверенного встречной подписью председателя участка */
  approveTrusted(data: ApproveKuTrustedInputDomainInterface): Promise<InnerTransactResult>;

  /** Отклонение заявки доверенного */
  declineTrusted(data: DeclineKuTrustedInputDomainInterface): Promise<InnerTransactResult>;
}

export const KU_BLOCKCHAIN_PORT = Symbol('KuBlockchainPort');
