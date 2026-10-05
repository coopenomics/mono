import { Injectable } from '@nestjs/common';
import { memberRolesOf, type AppRights, type MemberRole, type RightsCaller, type RightsTable } from '@coopenomics/extension-kit';

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

/** Описание прав расходов для общего гарда операций (`RightsGuard`). */
@Injectable()
export class ExpensesRights implements AppRights<MemberRole, never> {
  readonly extensionName = 'expenses';
  readonly table = expensesRightsTable;

  async roles(caller: RightsCaller): Promise<MemberRole[]> {
    return memberRolesOf(caller);
  }
}
