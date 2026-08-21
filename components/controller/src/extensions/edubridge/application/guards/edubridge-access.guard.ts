import { CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { hasServerSecret, platformSettings } from '@coopenomics/extension-kit';
import { LOGGER_PORT, type ILoggerPort } from '@coopenomics/innercoop';
import { canAccess } from '../access/edubridge-access-matrix';
import { EDUBRIDGE_ACCESS_METADATA_KEY, type IEdubridgeAccessRequirement } from '../decorators/edubridge-access.decorator';
import { EdubridgeMembershipService, type IEdubridgeMembership } from '../membership/edubridge-membership.service';

/** Ключ, под которым guard кладёт членство в GraphQL-контекст для `@CurrentEduMember`. */
export const EDUBRIDGE_MEMBERSHIP_CONTEXT_KEY = 'edubridgeMembership';

/**
 * Настоящий enforcement прав «Образовательного моста»: резолвер объявляет
 * `@RequireEduAccess(resource, action)`, guard вычисляет роли запросившего
 * (гость допустим — каталог открыт без входа) и сверяет с матрицей.
 * Ставится ПОСЛЕ `OptionalGqlJwtAuthGuard`/`GqlJwtAuthGuard`.
 */
@Injectable()
export class EdubridgeAccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly membership: EdubridgeMembershipService,
    @Inject(LOGGER_PORT) private readonly logger: ILoggerPort
  ) {
    this.logger.setContext(EdubridgeAccessGuard.name);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<IEdubridgeAccessRequirement | undefined>(
      EDUBRIDGE_ACCESS_METADATA_KEY,
      [context.getHandler(), context.getClass()]
    );

    const gqlContext = GqlExecutionContext.create(context).getContext();
    const request = gqlContext.req;

    const coopname = platformSettings().coopname;
    const membership: IEdubridgeMembership = await this.membership.resolve(coopname, request?.user ?? null);
    gqlContext[EDUBRIDGE_MEMBERSHIP_CONTEXT_KEY] = membership;

    if (!required) return true;
    if (hasServerSecret(request?.headers)) return true;

    if (canAccess(membership.roles, required.resource, required.action)) return true;

    this.logger.warn(
      `Отказ: ${membership.username ?? 'гость'} (${membership.roles.join(',')}) → ${required.resource}:${
        Array.isArray(required.action) ? required.action.join('|') : required.action
      } в ${context.getClass()?.name}.${context.getHandler()?.name}`
    );
    throw new ForbiddenException('Недостаточно прав доступа');
  }
}
