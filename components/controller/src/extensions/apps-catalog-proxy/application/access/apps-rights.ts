/**
 * Права приложения «Приложения» (26.10.2026): каталог и подписки узла.
 *
 *  - председатель — `Apps:manage`: подписывается, отменяет, включает и
 *    выключает приложения, настраивает их;
 *  - совет — `Apps:read`: видит каталог, установленные приложения, подписки
 *    и кошелёк кооператива у оператора;
 *  - пайщик-кооператив — `Connection:read:own`: страницы подключения у
 *    оператора (кооператив-пайщик смотрит свой счёт и подписки); данные там
 *    отдают резолверы ядра под своими правами, здесь — только видимость
 *    страниц. Пайщику-человеку подключение не показывается: условие `coop`
 *    читает вид учётной записи и выполняется только у организации-кооператива.
 */
import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { councilRolesOf, desktopGrantsOf, type AppRights, type RightsCaller, type RightsTable } from '@coopenomics/extension-kit';
import {
  ACCOUNT_PORT,
  DESKTOP_GRANTS_REGISTRY_PORT,
  type IAccountPort,
  type IDesktopGrantsRegistryPort,
} from '@coopenomics/innercoop';

export const APPS_DESKTOP_NAME = 'apps';

export type AppsRole = 'chairman' | 'council' | 'participant';
/** `coop` — учётная запись вошедшего принадлежит кооперативу (организация вида «coop»). */
export type AppsCondition = 'coop';

export const appsRightsTable: RightsTable<AppsRole, AppsCondition> = {
  chairman: [{ when: [], rights: { Apps: ['manage', 'read'] } }, { when: ['coop'], rights: { Connection: ['read:own'] } }],
  council: [{ when: [], rights: { Apps: ['read'] } }, { when: ['coop'], rights: { Connection: ['read:own'] } }],
  participant: [{ when: ['coop'], rights: { Connection: ['read:own'] } }],
};

const ACCEPTED_STATUS = 'active';
const ORGANIZATION_TYPE = 'organization';
const COOP_ORGANIZATION = 'coop';

@Injectable()
export class AppsRights implements AppRights<AppsRole, AppsCondition>, OnModuleInit {
  readonly extensionName = APPS_DESKTOP_NAME;
  readonly table = appsRightsTable;
  // Вид учётной записи стоит запроса к базе: читается, только когда право без него не складывается.
  readonly lazyConditions: AppsCondition[] = ['coop'];

  constructor(
    @Inject(DESKTOP_GRANTS_REGISTRY_PORT) private readonly grantsRegistry: IDesktopGrantsRegistryPort,
    @Inject(ACCOUNT_PORT) private readonly accounts: IAccountPort,
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

  async conditions(caller: RightsCaller, _roles: AppsRole[], wanted: readonly AppsCondition[]): Promise<ReadonlySet<AppsCondition>> {
    const held = new Set<AppsCondition>();
    if (wanted.includes('coop') && (await this.isCooperativeAccount(caller.username))) held.add('coop');
    return held;
  }

  /** Та же проверка, что у меню стола: организация, и её вид — кооператив. */
  private async isCooperativeAccount(username: string): Promise<boolean> {
    try {
      const account = await this.accounts.getAccount(username);
      const privateAccount = account?.private_account;
      if (!privateAccount || String(privateAccount.type).toLowerCase() !== ORGANIZATION_TYPE) return false;
      const kind = String(privateAccount.organization_data?.type ?? '').toLowerCase();
      return kind === COOP_ORGANIZATION;
    } catch {
      return false;
    }
  }
}
