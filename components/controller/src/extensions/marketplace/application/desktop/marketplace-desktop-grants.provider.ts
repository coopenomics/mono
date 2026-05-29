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
import { MarketplaceOnboardingService } from '../onboarding/marketplace-onboarding.service';

/**
 * Провайдер грантов «Стола заказов» для канона авторизации столов.
 *
 * `getDesktop` (платформа) вызывает его на каждый запрос десктопа и кладёт
 * результат в `DesktopWorkspace.grants` всех столов market. Логика — та же,
 * что в `MarketplaceMembershipGuard` (core-роли + isOfferer/isKuChairman →
 * marketplace-роли), но без 403: гость/не-пайщик → пустой набор.
 *
 * Онбординг сворачивается СЮДА на двух уровнях:
 *
 *  L1 (кооператив): пока совет не принял ЦПП
 *  (`config.coopAcceptance.accepted !== true`), единственное право —
 *  у председателя и только `Extension:configure` (страница подключения ЦПП).
 *  Так до принятия никто, кроме председателя, не видит ни столов, ни страниц.
 *
 *  L3 (пайщик-заказчик): даже после принятия ЦПП кооперативом orderer-права
 *  выдаются ТОЛЬКО если конкретный пайщик подписал персональную оферту ЦПП
 *  (`MarketplaceOnboardingService.requires_gate === false`). Пока не подписал —
 *  вместо рабочих orderer-прав выдаётся единственный маркер видимости
 *  `Onboarding:orderer` (страница подключения к Столу заказов). Это зеркало
 *  L1-гейта председателя на уровне отдельного пайщика: до подписи виден лишь
 *  онбординг, после — открывается полный стол заказчика. Прочие роли
 *  (offerer/operator/admin/board) от L3-оферты заказчика не зависят.
 *
 * Всё — без отдельного desktop-фильтра и без зеркального гейта во фронтовом
 * install.ts: видимость целиком определяется набором grants.
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
    @Inject(MARKETPLACE_KU_CHAIRMAN_SERVICE)
    private readonly kuChairmanService: MarketplaceKuChairmanService,
    private readonly onboardingService: MarketplaceOnboardingService,
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

    // L3-гейт заказчика: orderer-права материализуются только после подписи
    // персональной оферты ЦПП. Прочие роли считаем как есть.
    if (!roles.includes('orderer')) {
      return expandGrantsForRoles(roles);
    }

    const otherRoles = roles.filter((r) => r !== 'orderer');
    const grants = new Set(expandGrantsForRoles(otherRoles));

    const { requires_gate } = await this.onboardingService.getOnboardingState(
      ctx.username,
    );
    if (requires_gate) {
      grants.add('Onboarding:orderer');
    } else {
      for (const g of expandGrantsForRoles(['orderer'])) grants.add(g);
    }
    return [...grants];
  }
}
