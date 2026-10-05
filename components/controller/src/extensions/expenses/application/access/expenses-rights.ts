import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import {
  desktopGrantsOf,
  memberRolesOf,
  type AppRights,
  type MemberRole,
  type RightsCaller,
  type RightsTable,
} from '@coopenomics/extension-kit';
import { DESKTOP_GRANTS_REGISTRY_PORT, type IDesktopGrantsRegistryPort } from '@coopenomics/innercoop';

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
  ExpenseProposal: ['read'],
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
export const expensesRightsTable: RightsTable<MemberRole, never> = {
  participant: [{ when: [], rights: MEMBER_RIGHTS }],
  council: [
    {
      when: [],
      rights: {
        ...MEMBER_RIGHTS,
        ExpenseProposal: ['read', 'create', 'submit-report'],
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
};

/**
 * Описание прав расходов: по нему работают общий гард операций
 * (`RightsGuard`) и права страниц расходов.
 */
@Injectable()
export class ExpensesRights implements AppRights<MemberRole, never>, OnModuleInit {
  readonly extensionName = 'expenses';
  readonly table = expensesRightsTable;

  constructor(@Inject(DESKTOP_GRANTS_REGISTRY_PORT) private readonly grantsRegistry: IDesktopGrantsRegistryPort) {}

  onModuleInit(): void {
    const hook = desktopGrantsOf(this);
    this.grantsRegistry.register({ extensionName: EXPENSES_PAGES_DESKTOP, resolveGrants: (ctx) => hook.resolveGrants(ctx) });
  }

  async roles(caller: RightsCaller): Promise<MemberRole[]> {
    return memberRolesOf(caller);
  }
}
