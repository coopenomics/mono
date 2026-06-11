import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlContextType, GqlExecutionContext } from '@nestjs/graphql';
import config from '~/config/config';
import type { IAbilitySubjectUser } from './ability.factory';
import { CHECK_ABILITY, type CheckAbilityRequirement } from './check-ability.decorator';
import { PolicyService } from './policy.service';

/**
 * Единый guard всех 4 слоёв авторизации (Story 6.4). Читает `@CheckAbility` с
 * метода/класса; если требования нет — пропускает (endpoint не под CASL). Покрывает
 * и GraphQL-резолверы, и HTTP REST: извлекает user и атрибуты ресурса из обоих видов
 * контекста, затем делегирует `PolicyService.ensure` (Layer 1+2 Ability → Layer 3
 * политика → Layer 4 императивно — общий вычислитель). Отказ = `403` с обобщённым
 * кодом (специфика — только в лог).
 *
 * Применяется точечно на резолверах auth-v2 (миграция с `@AuthRoles` — Story 6.5),
 * НЕ глобально как APP_GUARD: legacy `auth/` остаётся на `@AuthRoles`.
 */
@Injectable()
export class AuthorizationGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly policyService: PolicyService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requirement = this.reflector.getAllAndOverride<CheckAbilityRequirement | undefined>(CHECK_ABILITY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requirement) return true; // endpoint не объявил требование CASL — не наше дело

    const { user, resource, serverSecret } = this.extract(context);

    // Серверный секрет — служебный обход (как RolesGuard); межсервисные вызовы.
    if (serverSecret && serverSecret === config.server_secret) return true;

    await this.policyService.ensure(requirement, user, resource);
    return true;
  }

  /** Достаёт user + атрибуты ресурса + server-secret из GraphQL или HTTP контекста. */
  private extract(context: ExecutionContext): {
    user: IAbilitySubjectUser | undefined;
    resource: Record<string, unknown> | undefined;
    serverSecret: string | undefined;
  } {
    if (context.getType<GqlContextType>() === 'graphql') {
      const gql = GqlExecutionContext.create(context);
      const req = gql.getContext().req;
      const args = gql.getArgs<Record<string, unknown>>();
      const resource = (args?.data ?? args?.filter ?? args) as Record<string, unknown> | undefined;
      return { user: req?.user, resource, serverSecret: req?.headers?.['server-secret'] };
    }
    const req = context.switchToHttp().getRequest();
    const resource = { ...(req?.params ?? {}), ...(req?.query ?? {}), ...(req?.body ?? {}) };
    return { user: req?.user, resource, serverSecret: req?.headers?.['server-secret'] };
  }
}
