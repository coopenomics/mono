import { hasServerSecret } from '@coopenomics/extension-kit';
import { Inject, CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';

import { LOGGER_PORT, type ILoggerPort } from '@coopenomics/innercoop';

import { canAccess } from '../access/marketplace-access-matrix';
import {
  MARKETPLACE_ACCESS_METADATA_KEY,
  type IMarketplaceAccessRequirement,
} from '../decorators/marketplace-access.decorator';
import type { IMarketplaceCurrentMember } from '../dto/marketplace-current-member.dto';
import { MARKETPLACE_ROLES_METADATA_KEY } from '../decorators/marketplace-role.decorator';
import type { MarketplaceRole } from '../membership/marketplace-roles.mapper';

/**
 * Guard проверки авторизации marketplace.
 *
 * Поддерживает обе семантики (Story 1.6 + Story 1.8):
 *   - `@RequireMarketplaceRole('admin', 'board')` — OR по ролям;
 *   - `@RequireMarketplaceAccess('Order', 'create')` — проверка через
 *     централизованную access-matrix (`marketplace-access-matrix.ts`).
 *
 * Если декораторы заданы оба — guard требует выполнения обоих
 * (логическое И). Если ни одного — guard разрешает (по аналогии с core
 * RolesGuard: «нет требования — нет ограничения», membership проверяется
 * отдельно `MarketplaceMembershipGuard`).
 *
 * Phase 2 миграция: `canAccess` подменяется на `ability.can(action, subject)`
 * — interface guard'а не меняется.
 */
@Injectable()
export class MarketplaceRoleGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(LOGGER_PORT) private readonly logger: ILoggerPort
  ) {
    this.logger.setContext(MarketplaceRoleGuard.name);
  }

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<MarketplaceRole[] | undefined>(
      MARKETPLACE_ROLES_METADATA_KEY,
      [context.getHandler(), context.getClass()]
    );
    const requiredAccess = this.reflector.getAllAndOverride<
      IMarketplaceAccessRequirement | undefined
    >(MARKETPLACE_ACCESS_METADATA_KEY, [context.getHandler(), context.getClass()]);

    const noRoles = !requiredRoles || requiredRoles.length === 0;
    if (noRoles && !requiredAccess) {
      return true;
    }

    const ctx = GqlExecutionContext.create(context);
    const gqlContext = ctx.getContext();
    const request = gqlContext.req;

    // Секрет межсервисного обхода сверяет сам каркас: значение ему передал
    // composition root, и сюда оно не попадает вовсе. Читать его из конфига
    // ядра расширению нельзя — это ровно тот секрет, который не должен
    // разъезжаться по коду.
    if (hasServerSecret(request?.headers)) {
      return true;
    }

    const currentMember =
      (gqlContext?.currentMember as IMarketplaceCurrentMember | undefined) ??
      (request?.currentMember as IMarketplaceCurrentMember | undefined);

    if (!currentMember) {
      throw new ForbiddenException(
        'Marketplace-контекст не инициализирован — поставьте MarketplaceMembershipGuard в @UseGuards раньше MarketplaceRoleGuard'
      );
    }

    const handlerName = context.getHandler()?.name ?? 'unknown_handler';
    const className = context.getClass()?.name ?? 'unknown_class';
    const memberRoles = currentMember.marketplace_roles as MarketplaceRole[];

    if (!noRoles && requiredRoles) {
      const matched = requiredRoles.find((role) => memberRoles.includes(role));
      if (!matched) {
        this.logger.warn(
          `forbidden-attempt: member=${currentMember.username} action=${className}.${handlerName} requested_role=[${requiredRoles.join(', ')}] actual_marketplace_roles=[${memberRoles.join(', ')}] actual_core_roles=[${currentMember.core_roles.join(', ')}]`
        );
        throw new ForbiddenException(
          `Forbidden: marketplace role '${requiredRoles.join(', ')}' required, member has [${memberRoles.join(', ')}]`
        );
      }
    }

    if (requiredAccess) {
      // action может быть массивом — OR: достаточно, чтобы роль удовлетворяла
      // хотя бы одному (см. IMarketplaceAccessRequirement).
      const actions = Array.isArray(requiredAccess.action)
        ? requiredAccess.action
        : [requiredAccess.action];
      const ok = actions.some((action) => canAccess(memberRoles, requiredAccess.resource, action));
      if (!ok) {
        this.logger.warn(
          `forbidden-attempt: member=${currentMember.username} action=${className}.${handlerName} requested_access=${requiredAccess.resource}:${actions.join('|')} actual_marketplace_roles=[${memberRoles.join(', ')}] actual_core_roles=[${currentMember.core_roles.join(', ')}]`
        );
        throw new ForbiddenException(
          `Forbidden: marketplace access '${requiredAccess.resource}:${actions.join('|')}' required, member has roles [${memberRoles.join(', ')}]`
        );
      }
    }

    return true;
  }
}
