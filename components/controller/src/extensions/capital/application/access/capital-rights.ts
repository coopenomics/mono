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

/** Имя рабочего стола расширения: под ним выдаются права страниц. */
export const CAPITAL_DESKTOP_NAME = 'capital';

/**
 * Исполнители Благороста на уровне кооператива:
 *  - `account`     — любой вошедший: действует только на своё имя;
 *  - `participant` — принятый пайщик;
 *  - `council`     — член совета, `chairman` — председатель.
 * Роль в проекте (автор, мастер, участник) сюда не входит: её ведёт таблица
 * ролей проекта в сервисах Благороста, и эта таблица её не заменяет.
 */
export type CapitalRole = 'account' | MemberRole;

/**
 * Таблица прав Благороста (C28-87): роль → право `Ресурс:действие`.
 *
 * Перенос один в один с прежних списков ролей операций. Право с охватом
 * «своё» (`:own`) — прежний проход «на своё имя»: имя в запросе сверяется с
 * вошедшим. Право без охвата — прежний проход по роли. Какой проект, сегмент
 * или результат доступен пайщику, решает таблица ролей проекта.
 */
export const capitalRightsTable: RightsTable<CapitalRole, never> = {
  account: [
    {
      when: [],
      rights: {
        CapitalExpense: ['read:own', 'generate:own'],
        CapitalProgram: ['refresh:own', 'generate:own'],
        Clearance: ['request:own', 'generate:own'],
        Commit: ['create:own', 'read:own'],
        Contributor: ['register:own', 'update:own', 'read:own', 'generate:own'],
        Debt: ['create:own', 'read:own', 'generate:own'],
        Favorite: ['manage:own'],
        Invest: ['generate:own', 'create:own', 'read:own'],
        Property: ['create:own', 'generate:own'],
        Result: ['create:own', 'read:own', 'generate:own'],
        Segment: ['convert:own', 'read:own', 'refresh:own'],
        Time: ['read:own', 'track:own'],
        Voting: ['calculate:own'],
        // Страницы стола открыты каждому вошедшему; данные на них отбирают операции.
        CapitalDesk: ['use'],
      },
    },
  ],
  participant: [
    {
      when: [],
      rights: {
        CapitalConfig: ['read'],
        CapitalExpense: ['read'],
        CapitalOnboarding: ['read'],
        Commit: ['approve', 'decline', 'read'],
        Contributor: ['read'],
        Cycle: ['read'],
        Debt: ['read'],
        Favorite: ['manage'],
        Invest: ['read'],
        Issue: ['update', 'read', 'create', 'delete'],
        Measure: ['read'],
        Metric: ['create', 'update', 'delete', 'read'],
        ProcessInstance: ['run', 'read'],
        ProcessTemplate: ['read'],
        Project: ['create-local', 'update', 'authors', 'plan', 'delete', 'read'],
        ProjectLog: ['read'],
        Result: ['create', 'read', 'sign'],
        Revision: ['read', 'update'],
        Segment: ['read', 'refresh'],
        Story: ['create', 'update', 'read', 'delete'],
        Time: ['read', 'track'],
        Voting: ['vote', 'calculate', 'read'],
      },
    },
  ],
  council: [
    {
      when: [],
      rights: {
        CapitalConfig: ['read'],
        CapitalExpense: ['read', 'generate'],
        CapitalOnboarding: ['read'],
        CapitalProgram: ['generate'],
        Clearance: ['generate'],
        Commit: ['approve', 'decline', 'read'],
        Contributor: ['read', 'generate'],
        Cycle: ['read'],
        Debt: ['read', 'generate'],
        Favorite: ['manage'],
        Invest: ['generate', 'read'],
        Issue: ['update', 'read', 'create', 'delete'],
        Measure: ['read'],
        Metric: ['create', 'update', 'delete', 'read'],
        ProcessInstance: ['run', 'read'],
        ProcessTemplate: ['manage', 'read'],
        ProgramExpense: ['create', 'read'],
        Project: ['create', 'create-local', 'update', 'master', 'authors', 'plan', 'status', 'delete', 'read'],
        ProjectLog: ['read'],
        Property: ['generate'],
        Result: ['create', 'read', 'generate', 'sign'],
        Revision: ['read', 'update'],
        Segment: ['convert', 'read', 'refresh'],
        Story: ['create', 'update', 'read', 'delete'],
        Time: ['read', 'track'],
        Voting: ['vote', 'calculate', 'read'],
        // Страницы совета: пайщики программы, распределения, расходы программы.
        CapitalDesk: ['council'],
      },
    },
  ],
  chairman: [
    {
      when: [],
      rights: {
        Allocation: ['manage'],
        CapitalConfig: ['update'],
        CapitalExpense: ['create'],
        CapitalOnboarding: ['update'],
        CapitalProgram: ['fund', 'refresh'],
        Clearance: ['request'],
        Commit: ['create'],
        Contributor: ['register', 'import', 'update'],
        Cycle: ['create'],
        Measure: ['update'],
        ProgramExpense: ['pay'],
        Result: ['sign-chairman'],
        Voting: ['conduct'],
        CapitalDesk: ['manage'],
      },
    },
  ],
};

/**
 * Описание прав Благороста: по нему работают общий гард операций расширения
 * (`RightsGuard`) и права страниц рабочего стола.
 */
@Injectable()
export class CapitalRights implements AppRights<CapitalRole, never>, OnModuleInit {
  readonly extensionName = CAPITAL_DESKTOP_NAME;
  readonly table = capitalRightsTable;

  constructor(@Inject(DESKTOP_GRANTS_REGISTRY_PORT) private readonly grantsRegistry: IDesktopGrantsRegistryPort) {}

  onModuleInit(): void {
    this.grantsRegistry.register(desktopGrantsOf(this));
  }

  async roles(caller: RightsCaller): Promise<CapitalRole[]> {
    return ['account', ...memberRolesOf(caller)];
  }
}
