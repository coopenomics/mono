import { CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

import { platformSettings, hasServerSecret } from '@coopenomics/extension-kit';
import { MonoAccountStatus } from '@coopenomics/innercoop';

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
    const user = request?.user as { username?: string; role?: string; status?: string } | undefined;

    // Межсервисный `server-secret` — это супер-админский доступ: запрос с ним
    // проходит, проверки членства и статуса пайщика не применяются. Но выйти
    // из гварда сразу нельзя: `currentMember` остался бы незаполненным, и
    // резолвер с `@CurrentMarketplaceMember()` падал бы невнятным
    // «MarketplaceMembershipGuard не отработал — currentMember отсутствует в
    // context» вместо того, чтобы отработать. Поэтому контекст заполняем и
    // здесь: от лица пользователя, если он в запросе есть, иначе — служебным
    // членом без ролей.
    const bypass = hasServerSecret(request?.headers);

    // Обе ветки «пользователя в запросе нет» разбираются в одном условии: так
    // TypeScript сужает `user` до заполненного, а `username` — до строки для
    // всего кода ниже (два раздельных `if` он в сужение не складывает).
    const username = user?.username;
    if (!user || !username) {
      if (!bypass) {
        throw new UnauthorizedException('Требуется авторизованный пользователь');
      }
      const serviceMember: IMarketplaceCurrentMember = {
        username: '',
        core_roles: [],
        marketplace_roles: [],
      };
      request.currentMember = serviceMember;
      gqlContext.currentMember = serviceMember;
      return true;
    }

    // Обе ветки выше гарантируют пользователя, но компилятор этого не выводит:
    // явное сужение, иначе ts-node (TS 5.9) не собирает файл.
    if (!user?.username) {
      throw new UnauthorizedException('Требуется авторизованный пользователь');
    }
    const username = user.username;

    // Под межсервисным секретом статус не проверяется: это служебный вызов,
    // а не запрос пайщика.
    if (!bypass && user.status !== MonoAccountStatus.Active) {
      throw new ForbiddenException('Доступ только для пайщиков кооператива');
    }

    const coreRoles = mapUserRoleToCoreRoles(user.role);
    // Оба источника берутся из dedicated-сервисов с TTL-кешем
    // (MarketplaceSupplierRegistryService / MarketplaceKuChairmanService),
    // чтобы guard на каждом GraphQL-запросе не лез в RPC и в БД на N+1.
    const [isOfferer, isKuChairman] = await Promise.all([
      this.supplierRegistry.isOfferer(platformSettings().coopname, username),
      this.kuChairmanService.isKuChairman(platformSettings().coopname, username),
    ]);
    const marketplaceRoles = mapCoreRolesToMarketplaceRoles(coreRoles, {
      isOfferer,
      isKuChairman,
    });

    const currentMember: IMarketplaceCurrentMember = {
      username,
      core_roles: coreRoles,
      marketplace_roles: marketplaceRoles,
    };

    request.currentMember = currentMember;
    gqlContext.currentMember = currentMember;

    return true;
  }
}
