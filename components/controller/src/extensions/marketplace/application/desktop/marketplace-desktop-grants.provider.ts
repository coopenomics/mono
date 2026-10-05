import { Inject, Injectable, OnModuleInit } from '@nestjs/common';

import { MonoAccountStatus,
  type IDesktopGrantsHook,
  type InnerDesktopGrantsContext,
  DESKTOP_GRANTS_REGISTRY_PORT,
  type IDesktopGrantsRegistryPort,
} from '@coopenomics/innercoop';

import { mapUserRoleToCoreRoles } from '../membership/core-roles.mapper';
import { mapCoreRolesToMarketplaceRoles } from '../membership/marketplace-roles.mapper';
import { rightsFor } from '../access/marketplace-access-matrix';
import { expandGrants } from '../access/marketplace-grants';
import { MarketplaceRightsService } from '../access/marketplace-rights.service';
import type { IConfig } from '../../types';
import {
  MARKETPLACE_SUPPLIER_REGISTRY_SERVICE,
  type MarketplaceSupplierRegistryService,
} from '../services/marketplace-supplier-registry.service';
import {
  MARKETPLACE_KU_CHAIRMAN_SERVICE,
  type MarketplaceKuChairmanService,
} from '../services/marketplace-ku-chairman.service';

/**
 * Провайдер прав «Стола заказов» для рабочего стола.
 *
 * `getDesktop` (платформа) вызывает его на каждый запрос стола и кладёт
 * результат в `DesktopWorkspace.grants` всех столов market. Права берутся из
 * той же таблицы и тем же сервисом, что и в серверном гарде
 * (`MarketplaceRightsService`): страница видна ровно тогда, когда сервер
 * выполнит её операции. Гость и не принятый пайщик получают пустой набор.
 *
 * Поверх прав стол получает три метки страниц подключения. Каждая живёт, пока
 * её условие ждёт выполнения, и исчезает вместе с ним:
 *  - `Onboarding:coop`    — председателю, пока совет не принял программу
 *    (страница одноразовая, решение владельца 14.09.2026);
 *  - `Onboarding:orderer` — пайщику, пока он не подписал оферту и не выбрал
 *    пункт выдачи (подпись при вступлении выбора пункта не заменяет;
 *    «подписи не требуется» у неподключённой программы подписью не считается —
 *    инцидент 2026-08-10);
 *  - `Onboarding:offerer` — пайщику без одобренной записи поставщика.
 *
 * Сам себя регистрирует в глобальном реестре (onModuleInit), поэтому платформа
 * не импортирует модуль marketplace (нет цикла зависимостей).
 */
@Injectable()
export class MarketplaceDesktopGrantsProvider
  implements IDesktopGrantsHook, OnModuleInit
{
  readonly extensionName = 'market';

  constructor(
    @Inject(DESKTOP_GRANTS_REGISTRY_PORT) private readonly grantsRegistry: IDesktopGrantsRegistryPort,
    @Inject(MARKETPLACE_SUPPLIER_REGISTRY_SERVICE)
    private readonly supplierRegistry: MarketplaceSupplierRegistryService,
    @Inject(MARKETPLACE_KU_CHAIRMAN_SERVICE)
    private readonly kuChairmanService: MarketplaceKuChairmanService,
    private readonly rights: MarketplaceRightsService,
  ) {}
  onModuleInit(): void {
    this.grantsRegistry.register(this);
  }

  async resolveGrants(ctx: InnerDesktopGrantsContext): Promise<string[]> {
    if (!ctx.username) return [];

    const coreRoles = mapUserRoleToCoreRoles(ctx.userRole);
    if (coreRoles.length === 0) return [];
    // Совет проходит по роли в любом статусе — как в гарде стола и в ядре.
    if (!coreRoles.includes('Member') && ctx.userStatus !== MonoAccountStatus.Active) return [];

    const [isOfferer, isKuChairman] = await Promise.all([
      this.supplierRegistry.isOfferer(ctx.coopname, ctx.username),
      this.kuChairmanService.isKuChairman(ctx.coopname, ctx.username),
    ]);
    const roles = mapCoreRolesToMarketplaceRoles(coreRoles, {
      isOfferer,
      isKuChairman,
    });
    const config = (ctx.config ?? null) as Partial<IConfig> | null;
    const held = await this.rights.heldConditions(ctx.coopname, ctx.username, roles, config);
    const grants = new Set(expandGrants(rightsFor(roles, held)));

    if (!held.has('coop-accepted')) {
      if (coreRoles.includes('Chairman')) grants.add('Onboarding:coop');
      return [...grants];
    }
    if (roles.includes('orderer') && !held.has('orderer-onboarded')) grants.add('Onboarding:orderer');
    if (!roles.includes('offerer')) grants.add('Onboarding:offerer');
    return [...grants];
  }
}
