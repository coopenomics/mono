import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import {
  councilRolesOf,
  desktopGrantsOf,
  type AppRights,
  type AssignableRole,
  type CouncilRole,
  type RightsCaller,
  type RightsTable,
} from '@coopenomics/extension-kit';
import {
  DESKTOP_GRANTS_REGISTRY_PORT,
  MonoAccountStatus,
  ROLE_ASSIGNMENTS_PORT,
  type IDesktopGrantsRegistryPort,
  type IRoleAssignmentsPort,
} from '@coopenomics/innercoop';
import { t } from '../../i18n';

/** Имя рабочего стола расширения: под ним выдаются права страниц. */
export const REPORTS_DESKTOP_NAME = 'reports';

/**
 * Исполнители Стола бухгалтера: роли совета и назначаемая роль `accountant` —
 * бухгалтер, которому председатель выдал стол на странице управления доступом.
 */
export type ReportsRole = CouncilRole | 'accountant';

/** Все возможности стола: отчётность, её реквизиты, календарь сдачи и удержанный налог. */
const FULL_DESK: Record<string, string[]> = {
  Report: ['read', 'draft', 'generate'],
  ReportRequisites: ['read', 'manage'],
  ReportCalendar: ['read', 'manage'],
  WithheldTax: ['read', 'pay'],
};

/** Чтение стола: совет видит отчётность, реквизиты, календарь сдачи и удержанный налог. */
const READ_DESK: Record<string, string[]> = {
  Report: ['read'],
  ReportRequisites: ['read'],
  ReportCalendar: ['read'],
  WithheldTax: ['read'],
};

/**
 * Таблица прав Стола бухгалтера (C28-87): роль → право `Ресурс:действие`.
 * Стол ведут председатель и бухгалтер, член совета его читает (C28-90).
 */
export const reportsRightsTable: RightsTable<ReportsRole, never> = {
  council: [{ when: [], rights: READ_DESK }],
  chairman: [{ when: [], rights: FULL_DESK }],
  accountant: [{ when: [], rights: FULL_DESK }],
};

/** Роли стола, которые председатель назначает пайщикам. */
export const reportsAssignableRoles: readonly AssignableRole<'accountant'>[] = [
  {
    key: 'accountant',
    title: t('reports.roles.accountant.title'),
    description: t('reports.roles.accountant.description'),
    permissions: [
      { title: t('reports.roles.accountant.permissions.reports'), access: 'read', rights: ['Report:read'] },
      { title: t('reports.roles.accountant.permissions.requisites'), access: 'read', rights: ['ReportRequisites:read'] },
      { title: t('reports.roles.accountant.permissions.calendar'), access: 'read', rights: ['ReportCalendar:read'] },
      { title: t('reports.roles.accountant.permissions.tax'), access: 'read', rights: ['WithheldTax:read'] },
      { title: t('reports.roles.accountant.permissions.drafts'), access: 'write', rights: ['Report:draft', 'Report:generate'] },
      { title: t('reports.roles.accountant.permissions.requisitesEdit'), access: 'write', rights: ['ReportRequisites:manage'] },
      { title: t('reports.roles.accountant.permissions.calendarMarks'), access: 'write', rights: ['ReportCalendar:manage'] },
      { title: t('reports.roles.accountant.permissions.taxPay'), access: 'write', rights: ['WithheldTax:pay'] },
      {
        title: t('reports.roles.accountant.permissions.registries'),
        access: 'read',
        rights: ['core/Ledger:read', 'core/Process:read:all'],
      },
      {
        title: t('reports.roles.accountant.permissions.participants'),
        access: 'read',
        rights: ['core/Account:read:all', 'core/Wallet:read:all'],
      },
    ],
    // Реестры процессов, операций, проводок, кошельков и счетов стол берёт
    // операциями ядра. Перенос между кошельками (`Ledger:move`) на столе
    // выключен и роли не выдаётся.
    coreRights: {
      Ledger: ['read'],
      Process: ['read:all'],
      Account: ['read:all'],
      Wallet: ['read:all'],
    },
  },
];

/**
 * Описание прав Стола бухгалтера: по нему работают общий гард операций
 * расширения (`RightsGuard`) и права страниц рабочего стола.
 */
@Injectable()
export class ReportsRights implements AppRights<ReportsRole, never>, OnModuleInit {
  readonly extensionName = REPORTS_DESKTOP_NAME;
  readonly table = reportsRightsTable;
  readonly assignableRoles = reportsAssignableRoles;

  constructor(
    @Inject(DESKTOP_GRANTS_REGISTRY_PORT) private readonly grantsRegistry: IDesktopGrantsRegistryPort,
    @Inject(ROLE_ASSIGNMENTS_PORT) private readonly roleAssignments: IRoleAssignmentsPort
  ) {}

  onModuleInit(): void {
    this.roleAssignments.declare(REPORTS_DESKTOP_NAME, this.assignableRoles);
    this.grantsRegistry.register(desktopGrantsOf(this));
  }

  /**
   * Роли совета и назначенные председателем. Назначение действует у принятого
   * пайщика: выход из кооператива закрывает стол без снятия роли.
   */
  async roles(caller: RightsCaller): Promise<ReportsRole[]> {
    const council: ReportsRole[] = councilRolesOf(caller.role);
    if (caller.status !== MonoAccountStatus.Active) return council;
    const assigned = await this.roleAssignments.rolesOf(REPORTS_DESKTOP_NAME, caller.username);
    return [...council, ...(assigned as ReportsRole[])];
  }
}
