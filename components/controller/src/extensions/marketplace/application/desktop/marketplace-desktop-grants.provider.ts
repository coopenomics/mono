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
  MARKETPLACE_SUPPLIER_REGISTRY_SERVICE,
  type MarketplaceSupplierRegistryService,
} from '../services/marketplace-supplier-registry.service';
import {
  MARKETPLACE_KU_CHAIRMAN_SERVICE,
  type MarketplaceKuChairmanService,
} from '../services/marketplace-ku-chairman.service';
import { MarketplaceOnboardingService } from '../onboarding/marketplace-onboarding.service';
import {
  MARKETPLACE_CART_REPOSITORY,
  type MarketplaceCartDomainRepository,
} from '../../domain/repositories/marketplace-cart.repository';

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
 *  выдаются ТОЛЬКО если выполнены ОБА независимых факта: (а) пайщик подписал
 *  персональную оферту ЦПП (`MarketplaceOnboardingService.requires_gate ===
 *  false` — могло произойти ещё на L2, при регистрации) И (б) пайщик выбрал
 *  кооперативный участок (КУ/пункт выдачи) — `MarketplaceCart.delivery_braname
 *  !== null`. Подпись оферты на L2 НЕ подразумевает выбор КУ — это отдельный
 *  шаг, которого при регистрации не было. Пока хотя бы одно из двух не
 *  выполнено — вместо рабочих orderer-прав выдаётся единственный маркер
 *  видимости `Onboarding:orderer` (страница подключения к Столу заказов, где
 *  КУ выбирается всегда, а подпись показывается, только если ещё не была дана
 *  на L2). Это зеркало L1-гейта председателя на уровне отдельного пайщика: до
 *  выполнения обоих условий виден лишь онбординг, после — открывается полный
 *  стол заказчика. Прочие роли (offerer/operator/admin/board) от L3-гейта
 *  заказчика не зависят.
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
    @Inject(MARKETPLACE_SUPPLIER_REGISTRY_SERVICE)
    private readonly supplierRegistry: MarketplaceSupplierRegistryService,
    @Inject(MARKETPLACE_KU_CHAIRMAN_SERVICE)
    private readonly kuChairmanService: MarketplaceKuChairmanService,
    private readonly onboardingService: MarketplaceOnboardingService,
    @Inject(MARKETPLACE_CART_REPOSITORY)
    private readonly cartRepository: MarketplaceCartDomainRepository,
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
      this.supplierRegistry.isOfferer(ctx.coopname, ctx.username),
      this.kuChairmanService.isKuChairman(ctx.coopname, ctx.username),
    ]);
    const roles = mapCoreRolesToMarketplaceRoles(coreRoles, {
      isOfferer,
      isKuChairman,
    });

    // Базовый набор грантов — все роли, кроме orderer (его материализуем ниже
    // с учётом L3-гейта заказчика).
    const otherRoles = roles.filter((r) => r !== 'orderer');
    const grants = new Set(expandGrantsForRoles(otherRoles));

    // L3-гейт заказчика: orderer-права материализуются только после подписи
    // персональной оферты ЦПП И выбора КУ — оферта могла быть подписана ещё на
    // L2 (регистрации), где выбора КУ не было вовсе, поэтому проверяем оба
    // факта независимо (см. класс-JSDoc выше).
    if (roles.includes('orderer')) {
      const [{ requires_gate }, cart] = await Promise.all([
        this.onboardingService.getOnboardingState(ctx.username),
        this.cartRepository.findByOrderer(ctx.coopname, ctx.username),
      ]);
      const needsGate = requires_gate || !cart?.delivery_braname;
      if (needsGate) {
        grants.add('Onboarding:orderer');
      } else {
        for (const g of expandGrantsForRoles(['orderer'])) grants.add(g);
      }
    }

    // Гейт поставщика: активный пайщик без одобренного допуска (offerer-роль
    // отсутствует ⇒ не одобрен в реестре и не сам кооператив) видит на столе
    // поставщика только страницу онбординга. После одобрения offerer-роль
    // даёт полный стол, маркер не нужен. Зеркало L3-гейта заказчика.
    if (!roles.includes('offerer')) {
      grants.add('Onboarding:offerer');
    }

    // Эпик 19: адресное хранение опционально. Права на боксы и на топологию
    // ячеек выдаются только там, где кооператив включил соответствующий
    // переключатель — иначе разделы просто не появляются на столе, и никакого
    // отдельного гейта во фронте не требуется.
    const warehouse = ctx.config?.warehouse as
      | { containers_enabled?: boolean; cells_enabled?: boolean }
      | undefined;
    if (!warehouse?.containers_enabled) {
      for (const g of [...grants]) {
        if (g.startsWith('Container:')) grants.delete(g);
      }
    }
    if (!warehouse?.cells_enabled) {
      for (const g of [...grants]) {
        if (g.startsWith('StorageCell:')) grants.delete(g);
      }
    }

    return [...grants];
  }
}
