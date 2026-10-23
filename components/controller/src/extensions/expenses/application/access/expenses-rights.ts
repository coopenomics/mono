import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import {
  desktopGrantsOf,
  memberRolesOf,
  rightsHeld,
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
 * пайщика, стола совета и стола кассира. Права страниц выдаются вместе с
 * правами стола пайщика — он есть у каждого вошедшего — и стола кассира: его
 * страница «Касса» читает реестр записок.
 */
const EXPENSES_PAGES_DESKTOPS = ['participant', 'cashier'];

/** Право читать реестр расходов кооператива целиком. */
const REGISTRY_READ = 'ExpenseRegistry:read';

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
 * Правка по кассе — у председателя и кассира: оплата строки и доплата
 * перерасхода, отчёт и возврат по авансу за получателя, закрывающие документы
 * к любой записке, закрытие расхода. Совет кассу и расходы читает.
 */
const CASH_DESK_RIGHTS = {
  ExpenseProposal: ['pay', 'overspend', 'submit-report'],
  ExpenseItem: ['report:all', 'return:all'],
  ExpenseFile: ['upload:all'],
};

/** Имя, под которым расходы объявляют ядру свои дополнения ролей. */
const EXPENSES_APP = 'expenses';

/**
 * Исполнители расходов: роли пайщика и совета, ревизор — роль стола совета —
 * и кассир — роль стола кассира. Обеим расходы дают чтение своего реестра.
 */
export type ExpensesRole = MemberRole | 'auditor' | 'cashier';

/**
 * Таблица прав расходов (C28-87): роль → право `Ресурс:действие`.
 *
 * Служебную записку подаёт совет, решение по ней принимает председатель;
 * подотчётное лицо отчитывается и возвращает остаток по своей строке. Совет
 * читает расходы и кассу, правят их председатель и кассир (решение владельца
 * 16.10.2026). Совет проходит по роли в любом статусе учётной записи, поэтому
 * права пайщика названы в его строке повторно.
 */
export const expensesRightsTable: RightsTable<ExpensesRole, never> = {
  participant: [{ when: [], rights: MEMBER_RIGHTS }],
  council: [
    {
      when: [],
      rights: {
        ...MEMBER_RIGHTS,
        ExpenseProposal: ['read', 'generate:own', 'generate:all', 'create'],
        ExpenseRegistry: ['read'],
      },
    },
  ],
  chairman: [
    {
      when: [],
      rights: {
        ...CASH_DESK_RIGHTS,
        ExpenseProposal: ['decide', ...CASH_DESK_RIGHTS.ExpenseProposal],
      },
    },
  ],
  // Ревизор читает реестр расходов кооператива и реквизиты получателей.
  auditor: [{ when: [], rights: { ExpenseRegistry: ['read'] } }],
  // Кассир выплачивает по утверждённым запискам и ведёт их до закрытия: видит
  // очередь на кассе, записку и реквизиты получателей.
  cashier: [{ when: [], rights: { ExpenseRegistry: ['read'], ...CASH_DESK_RIGHTS } }],
};

/** Роли других приложений, которым расходы дают права. */
export const expensesAttachedRoles: readonly AttachedRole<'auditor' | 'cashier'>[] = [
  {
    key: 'auditor',
    permissions: [{ title: t('expenses.roles.auditor.permissions.registry'), access: 'read', rights: [REGISTRY_READ] }],
  },
  {
    key: 'cashier',
    permissions: [
      { title: t('expenses.roles.cashier.permissions.registry'), access: 'read', rights: [REGISTRY_READ] },
      { title: t('expenses.roles.cashier.permissions.pay'), access: 'write', rights: ['ExpenseProposal:pay', 'ExpenseProposal:overspend'] },
      { title: t('expenses.roles.cashier.permissions.report'), access: 'write', rights: ['ExpenseItem:report:all', 'ExpenseItem:return:all'] },
      { title: t('expenses.roles.cashier.permissions.files'), access: 'write', rights: ['ExpenseFile:upload:all'] },
      { title: t('expenses.roles.cashier.permissions.close'), access: 'write', rights: ['ExpenseProposal:submit-report'] },
    ],
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
    for (const extensionName of EXPENSES_PAGES_DESKTOPS) {
      this.grantsRegistry.register({ extensionName, resolveGrants: (ctx) => hook.resolveGrants(ctx) });
    }
  }

  /** Роли пайщика и совета и назначенные председателем; назначение действует у принятого пайщика. */
  async roles(caller: RightsCaller): Promise<ExpensesRole[]> {
    const member: ExpensesRole[] = memberRolesOf(caller);
    if (caller.status !== MonoAccountStatus.Active) return member;
    const assigned = await this.roleAssignments.rolesOf(EXPENSES_APP, caller.username);
    return [...member, ...(assigned as ExpensesRole[])];
  }

  /**
   * Читает ли пайщик реестр расходов целиком: совет, ревизор и кассир. Им
   * открыта любая записка и её файлы, а не только свои.
   */
  async readsRegistry(caller: RightsCaller): Promise<boolean> {
    return this.holds(caller, REGISTRY_READ);
  }

  /** Есть ли у пайщика право `Ресурс:действие` по таблице расходов. */
  async holds(caller: RightsCaller, right: string): Promise<boolean> {
    const roles = await this.roles(caller);
    return rightsHeld(this.table, roles, new Set<never>()).includes(right);
  }
}
