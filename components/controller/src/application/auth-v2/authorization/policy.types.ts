import type { CoopAction, CoopSubject } from './ability.types';
import type { IAbilitySubjectUser } from './ability.factory';

/**
 * CASL Layer 3 (Story 6.3) — Policy Handlers. Слои 1 (статика) и 2 (`access_rules`)
 * решают «может ли роль X делать action над subject» декларативно. Layer 3 покрывает
 * правила, которым нужен runtime DB-lookup и которые невозможно выразить статической
 * матрицей: например «пайщик голосует только в своём кооперативе». Политика —
 * именованный обработчик, который guard (Story 6.4) вызывает после проверки Ability,
 * если на endpoint объявлен `@CheckAbility(..., { policy })`.
 */

/**
 * Контекст вычисления политики. `user` — субъект из сессии; `action`/`subject` —
 * запрошенная пара из `@CheckAbility`; `resource` — атрибуты конкретного экземпляра
 * (из аргументов запроса: id, coopname и т.п.), по которым политика делает DB-lookup.
 */
export interface PolicyEvaluationContext {
  user: IAbilitySubjectUser;
  action: CoopAction;
  subject: CoopSubject;
  resource?: Record<string, unknown>;
}

/**
 * Политика Layer 3. `name` — стабильный ключ реестра (тот же, что в
 * `@PolicyHandler(name)` и `@CheckAbility(..., { policy: name })`). `evaluate` решает
 * допуск; может быть async (DB-lookup). true = разрешить, false = запретить.
 */
export interface IPolicyHandler {
  readonly name: string;
  evaluate(context: PolicyEvaluationContext): boolean | Promise<boolean>;
}
