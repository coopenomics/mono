import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import {
  desktopGrantsOf,
  memberRolesOf,
  type AppRights,
  type AttachedRole,
  type MemberRole,
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

/**
 * Своего стола у расходов на сервере нет: их страницы открываются со стола
 * пайщика и стола совета. Права страниц выдаются вместе с правами стола
 * пайщика — он есть у каждого вошедшего.
 */
const EXPENSES_PAGES_DESKTOP = 'participant';

/**
 * Права пайщика в расходах: своя служебная записка и свои строки подотчёта,
 * файлы к ним, план расходов своего участка. Чья именно записка, строка или
 * участок — сверяют сервисы расходов по данным объекта.
 */
const MEMBER_RIGHTS = {
  // Документ записки пайщик собирает на своё имя: расход участка подаёт его
  // председатель — обычный пайщик.
  ExpenseProposal: ['read', 'generate:own'],
  ExpenseItem: ['report', 'return'],
  ExpenseFile: ['read', 'upload'],
  ExpensePlan: ['read', 'manage'],
};

/**
 * Таблица прав расходов (C28-87): роль → право `Ресурс:действие`.
 *
 * Служебную записку подаёт совет, решение по ней, оплату и перерасход ведёт
 * председатель; подотчётное лицо отчитывается и возвращает остаток по своей
 * строке. Совет проходит по роли в любом статусе учётной записи, поэтому права
 * пайщика названы в его строке повторно.
 */
/** Имя, под которым расходы объявляют ядру свои дополнения ролей. */
const EXPENSES_APP = 'expenses';

/**
 * Исполнители расходов: роли пайщика и совета и ревизор — роль стола совета,
 * которой расходы дают чтение своего реестра.
 */
export type ExpensesRole = MemberRole | 'auditor';

export const expensesRightsTable: RightsTable<ExpensesRole, never> = {
  participant: [{ when: [], rights: MEMBER_RIGHTS }],
  council: [
    {
      when: [],
      rights: {
        ...MEMBER_RIGHTS,
        ExpenseProposal: ['read', 'generate:own', 'generate:all', 'create', 'submit-report'],
        ExpenseRegistry: ['read'],
      },
    },
  ],
  chairman: [
    {
      when: [],
      rights: {
        ExpenseProposal: ['decide', 'pay', 'overspend'],
      },
    },
  ],
  // Ревизор читает реестр расходов кооператива и реквизиты получателей.
  auditor: [{ when: [], rights: { ExpenseRegistry: ['read'] } }],
};

/** Роли других приложений, которым расходы дают права. */
export const expensesAttachedRoles: readonly AttachedRole<'auditor'>[] = [
  {
    key: 'auditor',
    permissions: [{ title: t('expenses.roles.auditor.permissions.registry'), access: 'read', rights: ['ExpenseRegistry:read'] }],
  },
];

/**
 * Описание прав расходов: по нему работают общий гард операций
 * (`RightsGuard`) и права страниц расходов.
 */
@Injectable()
export class ExpensesRights implements AppRights<ExpensesRole, never>, OnModuleInit {
  readonly extensionName = EXPENSES_APP;
  readonly table = expensesRightsTable;
  readonly attachedRoles = expensesAttachedRoles;

  constructor(
    @Inject(DESKTOP_GRANTS_REGISTRY_PORT) private readonly grantsRegistry: IDesktopGrantsRegistryPort,
    @Inject(ROLE_ASSIGNMENTS_PORT) private readonly roleAssignments: IRoleAssignmentsPort
  ) {}

  onModuleInit(): void {
    this.roleAssignments.attach(EXPENSES_APP, this.attachedRoles);
    const hook = desktopGrantsOf(this);
    this.grantsRegistry.register({ extensionName: EXPENSES_PAGES_DESKTOP, resolveGrants: (ctx) => hook.resolveGrants(ctx) });
  }

  /** Роли пайщика и совета и назначенные председателем; назначение действует у принятого пайщика. */
  async roles(caller: RightsCaller): Promise<ExpensesRole[]> {
    const member: ExpensesRole[] = memberRolesOf(caller);
    if (caller.status !== MonoAccountStatus.Active) return member;
    const assigned = await this.roleAssignments.rolesOf(EXPENSES_APP, caller.username);
    return [...member, ...(assigned as ExpensesRole[])];
  }
}
