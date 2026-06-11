import { Injectable, Logger } from '@nestjs/common';
import { subject as asSubject } from '@casl/ability';
import { AbilityFactory, type IAbilitySubjectUser } from './ability.factory';
import { PolicyRegistry } from './policy.registry';
import type { CheckAbilityRequirement } from './check-ability.decorator';
import { AuthorizationDenialReason, authorizationDenied } from './authorization-denial';

/**
 * Императивный вычислитель авторизации (Layer 4, Story 6.4) — единая точка проверки
 * всех слоёв. `AuthorizationGuard` делегирует сюда (декларативный путь через
 * `@CheckAbility`), а резолверы/сервисы могут звать `ensure` напрямую для проверок,
 * которым нужен уже загруженный экземпляр ресурса (instance-level ownership), что
 * guard'у на входе недоступно.
 *
 * Порядок: Layer 1+2 (Ability `can`) → Layer 3 (именованная политика). Любой отказ —
 * `403` с обобщённым кодом; точная причина уходит только в лог (security: не
 * раскрываем, какой слой/правило отклонило).
 */
@Injectable()
export class PolicyService {
  private readonly logger = new Logger(PolicyService.name);

  constructor(
    private readonly abilityFactory: AbilityFactory,
    private readonly policies: PolicyRegistry,
  ) {}

  /**
   * Проверяет требование авторизации; бросает `403`, если доступ запрещён.
   * @param requirement пара action+subject и опциональная политика (из `@CheckAbility`).
   * @param user субъект из сессии.
   * @param resource атрибуты экземпляра (для conditions Ability и DB-lookup политики).
   */
  async ensure(
    requirement: CheckAbilityRequirement,
    user: IAbilitySubjectUser | undefined,
    resource?: Record<string, unknown>,
  ): Promise<void> {
    if (!user?.username) throw this.deny(AuthorizationDenialReason.NoSubjectUser, requirement, '<anon>');

    // Layer 1+2: свежая Ability (читает access_rules при каждой проверке — изменения
    // прав применяются немедленно; кэш в session-сторе + инвалидация — отдельная
    // оптимизация, см. publisher Story 6.2).
    const ability = await this.abilityFactory.createForParticipantWithRules(user);
    const target = resource ? asSubject(requirement.subject, resource) : requirement.subject;
    if (!ability.can(requirement.action, target as never))
      throw this.deny(AuthorizationDenialReason.InsufficientAbility, requirement, user.username);

    // Layer 3: именованная политика с runtime DB-lookup.
    if (requirement.policy) {
      const allowed = await this.policies.evaluate(requirement.policy, {
        user,
        action: requirement.action,
        subject: requirement.subject,
        resource,
      });
      if (!allowed) throw this.deny(AuthorizationDenialReason.PolicyDenied, requirement, user.username);
    }
  }

  private deny(reason: AuthorizationDenialReason, req: CheckAbilityRequirement, username: string): Error {
    this.logger.warn(
      `Отказ авторизации [${reason}]: ${username} ${req.action} ${req.subject}${req.policy ? ` policy=${req.policy}` : ''}`,
    );
    return authorizationDenied();
  }
}
