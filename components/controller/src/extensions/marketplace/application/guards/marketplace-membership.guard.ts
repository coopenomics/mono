import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

import config from '~/config/config';
import { MonoAccountStatusDomainInterface } from '~/domain/account/interfaces/mono-account-domain.interface';

import type { IMarketplaceCurrentMember } from '../dto/marketplace-current-member.dto';
import { mapUserRoleToCoreRoles } from '../membership/core-roles.mapper';
import { mapCoreRolesToMarketplaceRoles } from '../membership/marketplace-roles.mapper';

/**
 * Guard расширения marketplace (Стол заказов, Story 1.3).
 *
 * 1. Требует валидный JWT — без `request.user` → UnauthorizedException (HTTP 401,
 *    клиент уходит на login).
 * 2. Требует статус пайщика `active` (см. `ParticipantStatusSyncService`, который
 *    повышает `users.status` после `soviet::addpartcpnt`) — иначе ForbiddenException
 *    (HTTP 403, «Доступ только для пайщиков кооператива»).
 * 3. Формирует `IMarketplaceCurrentMember` (`username`, `core_roles[]`,
 *    `marketplace_roles[]` — пока []) и кладёт его в `request.currentMember`
 *    и в GraphQL `ctx.currentMember` для последующих resolver-ов через
 *    `@CurrentMarketplaceMember()`.
 *
 * Inter-service `server-secret` пропускает guard (как и core guards) — фоновые
 * вызовы между controller'ом и core-сервисами не требуют членства.
 */
@Injectable()
export class MarketplaceMembershipGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const ctx = GqlExecutionContext.create(context);
    const gqlContext = ctx.getContext();
    const request = gqlContext.req;

    if (request?.headers?.['server-secret'] === config.server_secret) {
      return true;
    }

    const user = request?.user as { username?: string; role?: string; status?: string } | undefined;

    if (!user?.username) {
      throw new UnauthorizedException('Требуется авторизованный пользователь');
    }

    if (user.status !== MonoAccountStatusDomainInterface.Active) {
      throw new ForbiddenException('Доступ только для пайщиков кооператива');
    }

    const coreRoles = mapUserRoleToCoreRoles(user.role);
    // Story 1.6: context-флаги (isOfferer/isKuChairman) пока всегда false —
    // источники whitelist и КУ-председательства реализуются в Эпиках 2/3.
    const marketplaceRoles = mapCoreRolesToMarketplaceRoles(coreRoles, {});

    const currentMember: IMarketplaceCurrentMember = {
      username: user.username,
      core_roles: coreRoles,
      marketplace_roles: marketplaceRoles,
    };

    request.currentMember = currentMember;
    gqlContext.currentMember = currentMember;

    return true;
  }
}
