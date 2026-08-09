import { CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

import { platformSettings, hasServerSecret } from '@coopenomics/extension-kit';
import { MonoAccountStatusDomainInterface } from '~/domain/account/interfaces/mono-account-domain.interface';

import type { IMarketplaceCurrentMember } from '../dto/marketplace-current-member.dto';
import { mapUserRoleToCoreRoles } from '../membership/core-roles.mapper';
import { mapCoreRolesToMarketplaceRoles } from '../membership/marketplace-roles.mapper';
import {
  MARKETPLACE_KU_CHAIRMAN_SERVICE,
  type MarketplaceKuChairmanService,
} from '../services/marketplace-ku-chairman.service';
import {
  MARKETPLACE_SUPPLIER_REGISTRY_SERVICE,
  type MarketplaceSupplierRegistryService,
} from '../services/marketplace-supplier-registry.service';

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
  constructor(
    @Inject(MARKETPLACE_SUPPLIER_REGISTRY_SERVICE)
    private readonly supplierRegistry: MarketplaceSupplierRegistryService,
    @Inject(MARKETPLACE_KU_CHAIRMAN_SERVICE)
    private readonly kuChairmanService: MarketplaceKuChairmanService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
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

    const user = request?.user as { username?: string; role?: string; status?: string } | undefined;

    if (!user?.username) {
      throw new UnauthorizedException('Требуется авторизованный пользователь');
    }

    if (user.status !== MonoAccountStatusDomainInterface.Active) {
      throw new ForbiddenException('Доступ только для пайщиков кооператива');
    }

    const coreRoles = mapUserRoleToCoreRoles(user.role);
    // Оба источника берутся из dedicated-сервисов с TTL-кешем
    // (MarketplaceSupplierRegistryService / MarketplaceKuChairmanService),
    // чтобы guard на каждом GraphQL-запросе не лез в RPC и в БД на N+1.
    const [isOfferer, isKuChairman] = await Promise.all([
      this.supplierRegistry.isOfferer(platformSettings().coopname, user.username),
      this.kuChairmanService.isKuChairman(platformSettings().coopname, user.username),
    ]);
    const marketplaceRoles = mapCoreRolesToMarketplaceRoles(coreRoles, {
      isOfferer,
      isKuChairman,
    });

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
