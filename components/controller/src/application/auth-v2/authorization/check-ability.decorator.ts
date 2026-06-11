import { SetMetadata } from '@nestjs/common';
import type { CoopAction, CoopSubject } from './ability.types';

/** Ключ метаданных, который читает `AuthorizationGuard` (Story 6.4). */
export const CHECK_ABILITY = 'coopid:check-ability';

/**
 * Требование авторизации на endpoint: пара `action`+`subject` (проверяется по Ability,
 * Layer 1+2) и опциональная `policy` (Layer 3, исполняется `PolicyRegistry`). Guard
 * объединяющий все слои — Story 6.4; здесь — декларация требования и его тип.
 */
export interface CheckAbilityRequirement {
  action: CoopAction;
  subject: CoopSubject;
  /** Имя политики Layer 3 (`@PolicyHandler(name)`); если задано — guard её исполнит. */
  policy?: string;
}

/**
 * Объявляет требование авторизации (Story 6.5 заменяет им `@AuthRoles` в auth-v2).
 *
 * @example `@CheckAbility('vote', 'CriticalAction', { policy: 'same-coop-voting' })`
 */
export function CheckAbility(
  action: CoopAction,
  subject: CoopSubject,
  options?: { policy?: string },
): MethodDecorator & ClassDecorator {
  const requirement: CheckAbilityRequirement = { action, subject, policy: options?.policy };
  return SetMetadata(CHECK_ABILITY, requirement);
}
