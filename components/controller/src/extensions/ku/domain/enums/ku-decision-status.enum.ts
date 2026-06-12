import { registerEnumType } from '@nestjs/graphql';

/**
 * Статус решения собрания пайщиков кооперативного участка.
 * Значения совпадают со статусами контракта branch.
 */
export enum KuDecisionStatus {
  /** Собрание объявлено, открыто присоединение участников */
  OPENED = 'opened',
  /** Голосование открыто */
  VOTING = 'voting',
  /** Протокол утверждён председателем собрания */
  APPROVED = 'approved',
  /** Заявление направлено на рассмотрение совета */
  ONAPPROVAL = 'onapproval',
  /** Завершено (запись стёрта в блокчейне: исполнено или отклонено) */
  COMPLETED = 'completed',
  /** Отменено организатором собрания */
  CANCELLED = 'cancelled',
}

registerEnumType(KuDecisionStatus, {
  name: 'KuDecisionStatus',
  description: 'Статус решения собрания пайщиков кооперативного участка',
});
