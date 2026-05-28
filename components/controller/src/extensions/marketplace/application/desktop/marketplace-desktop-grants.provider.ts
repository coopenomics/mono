import { Inject, Injectable, OnModuleInit } from '@nestjs/common';

import { MonoAccountStatusDomainInterface } from '~/domain/account/interfaces/mono-account-domain.interface';
import { ExtensionGrantsRegistry } from '~/application/desktop/extension-grants.registry';
import type {
  IDesktopGrantsContext,
  IExtensionDesktopGrantsProvider,
} from '~/domain/desktop/ports/extension-grants.port';

import { mapUserRoleToCoreRoles } from '../membership/core-roles.mapper';
import { mapCoreRolesToMarketplaceRoles } from '../membership/marketplace-roles.mapper';
import { expandGrantsForRoles } from '../access/marketplace-grants';
import {
  MARKETPLACE_WHITELIST_SERVICE,
  type MarketplaceWhitelistService,
} from '../services/marketplace-whitelist.service';
import {
  MARKETPLACE_KU_CHAIRMAN_SERVICE,
  type MarketplaceKuChairmanService,
} from '../services/marketplace-ku-chairman.service';

/**
 * Провайдер грантов «Стола заказов» для канона авторизации столов.
 *
 * `getDesktop` (платформа) вызывает его на каждый запрос десктопа и кладёт
 * результат в `DesktopWorkspace.grants` всех столов market. Логика — та же,
 * что в `MarketplaceMembershipGuard` (core-роли + isOfferer/isKuChairman →
 * marketplace-роли), но без 403: гость/не-пайщик → пустой набор.
 *
 * Онбординг сворачивается СЮДА: пока совет не принял ЦПП
 * (`config.coopAcceptance.accepted !== true`), единственное право —
 * у председателя и только `Extension:configure` (страница подключения ЦПП).
 * Так до принятия никто, кроме председателя, не видит ни столов, ни страниц —
 * без отдельного desktop-фильтра и без зеркального гейта во фронтовом install.ts.
 *
 * Сам себя регистрирует в глобальном реестре (onModuleInit), поэтому платформа
 * не импортирует модуль marketplace (нет цикла зависимостей).
 */
@Injectable()
export class MarketplaceDesktopGrantsProvider
  implements IExtensionDesktopGrantsProvider, OnModuleInit
{
  readonly extensionName = 'market';

  constructor(
    private readonly grantsRegistry: ExtensionGrantsRegistry,
    @Inject(MARKETPLACE_WHITELIST_SERVICE)
    private readonly whitelistService: MarketplaceWhitelistService,
    @Inject(MARKETPLACE_KU_CHAIRMEN_SERVICE)
    private readonly kuChairmanService: MarketplaceKuChairmanService,
  ) {}

  onModuleInit(): void {
    this.grantsRegistry.register(this);
  }

  async resolveGrants(ctx: IDesktopGrantsContext): Promise<string[]> {
    if (!ctx.username) return [];
    if (ctx.userStatus !== MonoAccountStatusDomainInterface.Active) return [];

    const coreRoles = mapUserRoleToCoreRoles(ctx.userRole);
    if (coreRoles.length === 0) return [];

    const onboarded = Boolean(ctx.config?.coopAcceptance?.accepted);
    if (!onboarded) {
      return coreRoles.includes('Chairman') ? ['Extension:configure'] : [];
    }

    const [isOfferer, isKuChairman] = await Promise.all([
      this.whitelistService.isOfferer(ctx.coopname, ctx.username),
      this.kuChairmanService.isKuChairman(ctx.coopname, ctx.username),
    ]);
    const roles = mapCoreRolesToMarketplaceRoles(coreRoles, {
      isOfferer,
      isKuChairman,
    });
    return expandGrantsForRoles(roles);
  }
}
