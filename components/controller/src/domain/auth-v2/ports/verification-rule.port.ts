import type { VerificationRule } from '~/domain/auth-v2/verification/verification.types';

/**
 * Порт хранилища per-coop правил применения типов верификации (CoopID, Story 4.2).
 * Одна запись на действие (action_code = PRIMARY KEY). Хранилище — coop_domain_db
 * текущего кооператива (controller обслуживает один кооператив, поэтому per-coop
 * совпадает с самой БД — как `recovery_strategy`, без колонки coopname).
 */
export const VERIFICATION_RULE_REPOSITORY = Symbol('VerificationRuleRepository');

export interface IVerificationRuleRepository {
  /** Правило для действия либо null, если для него ограничений не задано. */
  findByActionCode(actionCode: string): Promise<VerificationRule | null>;
  /** Все заданные правила кооператива. */
  list(): Promise<VerificationRule[]>;
  /** Создать/перезаписать правило действия. */
  upsert(rule: VerificationRule): Promise<void>;
}
