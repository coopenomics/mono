/**
 * Порт CASL Layer 2 (Story 6.2): декларативные точечные права `access_rules` в
 * coop_domain_db. Правило навешивается на core-роль (всем носителям) либо на
 * конкретного пайщика (username) и мерджится поверх статической Ability (Story 6.1).
 */

/** Эффект правила: расширяет (allow) или сужает (deny) права. */
export enum AccessRuleEffect {
  Allow = 'allow',
  Deny = 'deny',
}

/** Тип принципала, на которого навешано правило. */
export enum AccessRulePrincipalKind {
  Role = 'role',
  Participant = 'participant',
  /** Именованный набор возможностей (Story 6.11); `subject_id` = `set_key`. */
  CapabilitySet = 'capability_set',
}

/**
 * Запись правила. `action`/`resourceType` — строки на границе порта (свобода БД);
 * `AbilityFactory` кастует их к CoopAction/CoopSubject при сборке. `conditions` —
 * CASL-условия (например `{ owner: username }`), либо null (правило над любым экземпляром).
 */
export interface AccessRuleRecord {
  subjectType: AccessRulePrincipalKind;
  subjectId: string;
  effect: AccessRuleEffect;
  action: string;
  resourceType: string;
  conditions: Record<string, unknown> | null;
  /** TTL точечного capability (Story 6.7); null — бессрочно. */
  expiresAt?: Date | null;
}

export const ACCESS_RULES_REPOSITORY = Symbol('AccessRulesRepository');

export interface IAccessRulesRepository {
  /**
   * Правила, применимые к пайщику: навешанные на любую из его core-ролей ИЛИ
   * персонально на его username. Истёкшие (`expires_at <= now`) исключаются.
   */
  findForPrincipal(roles: string[], username: string): Promise<AccessRuleRecord[]>;
  /**
   * Правила назначенных пайщику наборов возможностей (Story 6.11): строки
   * `subject_type='capability_set'` с `subject_id` из переданных ключей. Истёкшие
   * (`expires_at <= now`) исключаются. Пустой `setKeys` → пустой результат.
   */
  findForCapabilitySets(setKeys: string[]): Promise<AccessRuleRecord[]>;
  /** Создать правило (admin-запись ролей/capabilities — Story 6.6/6.7). */
  insert(rule: AccessRuleRecord): Promise<void>;
}

/** Принципал, чьи права изменились (для инвалидации активных сессий). */
export interface AccessRulesInvalidationTarget {
  subjectType: AccessRulePrincipalKind;
  subjectId: string;
}

/** Redis-канал инвалидации прав активных сессий (подписчик — Story 6.4). */
export const ACCESS_RULES_INVALIDATION_CHANNEL = 'coopid:access-rules:invalidate';

export const ACCESS_RULES_INVALIDATION_PUBLISHER = Symbol('AccessRulesInvalidationPublisher');

export interface IAccessRulesInvalidationPublisher {
  /** Опубликовать, что права принципала изменились — активные сессии пересоберут Ability. */
  publish(target: AccessRulesInvalidationTarget): Promise<void>;
}
