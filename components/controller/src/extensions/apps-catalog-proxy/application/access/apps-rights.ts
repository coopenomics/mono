/**
 * Права приложения «Приложения» (26.10.2026): каталог и подписки узла.
 *
 *  - председатель — `Apps:manage`: подписывается, отменяет, включает и
 *    выключает приложения, настраивает их;
 *  - совет — `Apps:read`: видит каталог, установленные приложения, подписки
 *    и кошелёк кооператива у оператора;
 *  - пайщик — `Connection:read:own`: страницы подключения у оператора
 *    (кооператив-пайщик смотрит свой счёт и подписки); данные там отдают
 *    резолверы ядра под своими правами, здесь — только видимость страниц.
 */
import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { councilRolesOf, desktopGrantsOf, type AppRights, type RightsCaller, type RightsTable } from '@coopenomics/extension-kit';
import { DESKTOP_GRANTS_REGISTRY_PORT, type IDesktopGrantsRegistryPort } from '@coopenomics/innercoop';

export const APPS_DESKTOP_NAME = 'apps';

export type AppsRole = 'chairman' | 'council' | 'participant';

export const appsRightsTable: RightsTable<AppsRole, never> = {
  chairman: [{ when: [], rights: { Apps: ['manage', 'read'], Connection: ['read:own'] } }],
  council: [{ when: [], rights: { Apps: ['read'], Connection: ['read:own'] } }],
  participant: [{ when: [], rights: { Connection: ['read:own'] } }],
};

const ACCEPTED_STATUS = 'active';

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
    if (caller.status === ACCEPTED_STATUS) roles.push('participant');
    return roles;
  }
}
