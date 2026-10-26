/**
 * Права приложения «Приложения» (26.10.2026): каталог и подписки узла.
 *
 *  - председатель — `Apps:manage`: подписывается, отменяет, включает и
 *    выключает приложения, настраивает их;
 *  - совет — `Apps:read`: видит каталог, установленные приложения, подписки
 *    и кошелёк кооператива у оператора.
 *
 * Пайщику без роли в совете стол не показывается: у него нет ни одной
 * страницы с выданным правом. Подключение кооператива у оператора живёт на
 * столе пайщика под правами ядра (решение владельца 26.10.2026).
 */
import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { councilRolesOf, desktopGrantsOf, type AppRights, type RightsCaller, type RightsTable } from '@coopenomics/extension-kit';
import { DESKTOP_GRANTS_REGISTRY_PORT, type IDesktopGrantsRegistryPort } from '@coopenomics/innercoop';

export const APPS_DESKTOP_NAME = 'apps';

export type AppsRole = 'chairman' | 'council';

export const appsRightsTable: RightsTable<AppsRole, never> = {
  chairman: [{ when: [], rights: { Apps: ['manage', 'read'] } }],
  council: [{ when: [], rights: { Apps: ['read'] } }],
};

@Injectable()
export class AppsRights implements AppRights<AppsRole, never>, OnModuleInit {
  readonly extensionName = APPS_DESKTOP_NAME;
  readonly table = appsRightsTable;

  constructor(
    @Inject(DESKTOP_GRANTS_REGISTRY_PORT) private readonly grantsRegistry: IDesktopGrantsRegistryPort,
  ) {}

  onModuleInit(): void {
    this.grantsRegistry.register(desktopGrantsOf(this));
  }

  async roles(caller: RightsCaller): Promise<AppsRole[]> {
    const roles: AppsRole[] = [];
    const council = councilRolesOf(caller.role);
    if (council.includes('chairman')) roles.push('chairman');
    if (council.includes('council')) roles.push('council');
    return roles;
  }
}
