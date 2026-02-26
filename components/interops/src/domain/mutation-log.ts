/**
 * Порт журнала мутаций
 */

export interface IMutationLogDomain {
  id?: string;
  coopname: string;
  username: string;
  action: string;
  entity_type: string;
  entity_id: string;
  data?: Record<string, any>;
  created_at?: Date;
}

export interface IMutationLogRepository {
  save(log: IMutationLogDomain): Promise<void>;
  find(filter: any, options?: any): Promise<{ items: IMutationLogDomain[]; totalCount: number }>;
}

export const MUTATION_LOG_REPOSITORY = Symbol('MutationLogRepository');
