import { hasServerSecret, DomainError, platformSettings, RIGHT_METADATA_KEY, type IRightRequirement } from '@coopenomics/extension-kit';
import { Inject, CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';

import { LOGGER_PORT, type ILoggerPort } from '@coopenomics/innercoop';

import type { MarketplaceCondition } from '../access/marketplace-access-matrix';
import { MarketplaceRightsService } from '../access/marketplace-rights.service';
import type { IMarketplaceCurrentMember } from '../dto/marketplace-current-member.dto';
import { MARKETPLACE_ROLES_METADATA_KEY } from '../decorators/marketplace-role.decorator';
import type { MarketplaceRole } from '../membership/marketplace-roles.mapper';

/**
 * Guard проверки авторизации marketplace.
 *
 * Поддерживает обе семантики (Story 1.6 + Story 1.8):
 *   - `@RequireMarketplaceRole('admin', 'board')` — OR по ролям;
 *   - `@RequireRight('Order', 'create')` — проверка через
 *     централизованную access-matrix (`marketplace-access-matrix.ts`).
 *
 * Если декораторы заданы оба — guard требует выполнения обоих
 * (логическое И). Если ни одного — guard разрешает (по аналогии с core
 * RolesGuard: «нет требования — нет ограничения», membership проверяется
 * отдельно `MarketplaceMembershipGuard`).
 *
 * Право сверяется с таблицей вместе с условием строки (C28-87): роль, которой
 * право положено, получает отказ, пока условие не выполнено — программа не
 * принята советом, заказчик не подключён, хранение выключено.
 */
/** Отказ по условию строки таблицы прав: что именно ждёт выполнения. */
const CONDITION_DENIALS: Record<MarketplaceCondition, string> = {
  'coop-accepted': 'MARKETPLACE_COOP_NOT_CONNECTED',
  'orderer-onboarded': 'MARKETPLACE_ORDERER_ONBOARDING_REQUIRED',
  'containers-enabled': 'MARKETPLACE_CONTAINERS_DISABLED',
  'cells-enabled': 'MARKETPLACE_STORAGE_CELLS_DISABLED',
};

@Injectable()
export class MarketplaceRoleGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(LOGGER_PORT) private readonly logger: ILoggerPort,
    private readonly rights: MarketplaceRightsService
  ) {
    this.logger.setContext(MarketplaceRoleGuard.name);
  }

  canActivate(context: ExecutionContext): boolean | Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<MarketplaceRole[] | undefined>(
      MARKETPLACE_ROLES_METADATA_KEY,
      [context.getHandler(), context.getClass()]
    );
    const requiredAccess = this.reflector.getAllAndOverride<
      IRightRequirement | undefined
    >(RIGHT_METADATA_KEY, [context.getHandler(), context.getClass()]);

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
      throw DomainError.forbidden('MARKETPLACE_ROLE_GUARD_CONTEXT_MISSING');
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

    if (!requiredAccess) return true;
    return this.checkAccess(currentMember, memberRoles, requiredAccess, `${className}.${handlerName}`);
  }

  /**
   * Право по таблице вместе с условием строки. Асинхронная часть гарда:
   * проверка одной роли выше отвечает сразу.
   */
  private async checkAccess(
    currentMember: IMarketplaceCurrentMember,
    memberRoles: MarketplaceRole[],
    requiredAccess: IRightRequirement,
    operation: string
  ): Promise<boolean> {
    // action может быть массивом — OR: достаточно, чтобы роль удовлетворяла
    // хотя бы одному (см. IRightRequirement).
    const actions = Array.isArray(requiredAccess.action)
      ? requiredAccess.action
      : [requiredAccess.action];
    let ok = false;
    let missing: MarketplaceCondition | undefined;
    for (const action of actions) {
      const check = await this.rights.check(
        platformSettings().coopname,
        currentMember.username,
        memberRoles,
        requiredAccess.resource,
        action
      );
      if (check.allowed) {
        ok = true;
        break;
      }
      missing = missing ?? check.missing;
    }
    if (!ok && missing) {
      throw DomainError.forbidden(CONDITION_DENIALS[missing]);
    }
    if (!ok) {
      this.logger.warn(
        `forbidden-attempt: member=${currentMember.username} action=${operation} requested_access=${requiredAccess.resource}:${actions.join('|')} actual_marketplace_roles=[${memberRoles.join(', ')}] actual_core_roles=[${currentMember.core_roles.join(', ')}]`
      );
      throw new ForbiddenException(
        `Forbidden: marketplace access '${requiredAccess.resource}:${actions.join('|')}' required, member has roles [${memberRoles.join(', ')}]`
      );
    }

    return true;
  }
}
