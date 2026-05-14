import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';

import config from '~/config/config';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';

import type { IMarketplaceCurrentMember } from '../dto/marketplace-current-member.dto';
import { MARKETPLACE_ROLES_METADATA_KEY } from '../decorators/marketplace-role.decorator';
import type { MarketplaceRole } from '../membership/marketplace-roles.mapper';

/**
 * Story 1.6: Guard проверки marketplace-роли.
 *
 * Ставится ПОСЛЕ `MarketplaceMembershipGuard` (тот формирует `currentMember`).
 * Читает `@RequireMarketplaceRole(...)` метаданные → проверяет
 * `Array.includes` хотя бы одной требуемой роли в `currentMember.marketplace_roles`.
 *
 * Решение принимается локально (MVP). В Phase 2 источник policy сменится с
 * `marketplace-roles.mapper.ts` на платформенный CASL `defineAbility` —
 * Guard и декоратор останутся, изменится только маппер.
 *
 * При запрете пишет structured log `forbidden-attempt` с member_id,
 * action, requested_role, actual_marketplace_roles, actual_core_roles.
 */
@Injectable()
export class MarketplaceRoleGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly logger: WinstonLoggerService
  ) {
    this.logger.setContext(MarketplaceRoleGuard.name);
  }

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<MarketplaceRole[] | undefined>(
      MARKETPLACE_ROLES_METADATA_KEY,
      [context.getHandler(), context.getClass()]
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const ctx = GqlExecutionContext.create(context);
    const gqlContext = ctx.getContext();
    const request = gqlContext.req;

    if (request?.headers?.['server-secret'] === config.server_secret) {
      return true;
    }

    const currentMember =
      (gqlContext?.currentMember as IMarketplaceCurrentMember | undefined) ??
      (request?.currentMember as IMarketplaceCurrentMember | undefined);

    if (!currentMember) {
      // MarketplaceMembershipGuard должен был отработать раньше; если не сработал —
      // отказываем (защита от рассогласования настройки UseGuards).
      throw new ForbiddenException(
        'Marketplace-контекст не инициализирован — поставьте MarketplaceMembershipGuard в @UseGuards раньше MarketplaceRoleGuard'
      );
    }

    const matched = requiredRoles.find((role) => currentMember.marketplace_roles.includes(role));
    if (matched) {
      return true;
    }

    const requestedLabel = requiredRoles.join(', ');
    const handlerName = context.getHandler()?.name ?? 'unknown_handler';
    const className = context.getClass()?.name ?? 'unknown_class';

    this.logger.warn(
      `forbidden-attempt: member=${currentMember.username} action=${className}.${handlerName} requested_role=[${requestedLabel}] actual_marketplace_roles=[${currentMember.marketplace_roles.join(', ')}] actual_core_roles=[${currentMember.core_roles.join(', ')}]`
    );

    throw new ForbiddenException(
      `Forbidden: marketplace role '${requestedLabel}' required, member has [${currentMember.marketplace_roles.join(', ')}]`
    );
  }
}
