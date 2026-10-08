import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import {
  desktopGrantsOf,
  memberRolesOf,
  type AppRights,
  type MemberRole,
  type RightFacts,
  type RightsCaller,
  type RightsTable,
} from '@coopenomics/extension-kit';
import { DESKTOP_GRANTS_REGISTRY_PORT, type IDesktopGrantsRegistryPort } from '@coopenomics/innercoop';
import { LOAN_REPOSITORY, type LoanRepository } from '../../domain/repositories/loan.repository';

/**
 * Права пайщика в займах: свои займы — смотреть, подавать заявление, отменять
 * до выплаты, возвращать и продлевать. Чей заём — сверяет сервис по записи.
 */
const MEMBER_RIGHTS = {
  Loan: ['read:own', 'create:own', 'generate:own', 'cancel:own', 'repay:own', 'extend:own'],
  LoanCollateral: ['read:own'],
};

/**
 * Таблица прав займов (C28-87): роль → право `Ресурс:действие`.
 *
 * Совет видит все займы и формирует протокол решения; председатель, кроме
 * того, повторяет платёж после отказа кассира и отменяет выдачу. Совет
 * проходит по роли в любом статусе учётной записи, поэтому права пайщика
 * названы в его строке повторно.
 */
export const debtRightsTable: RightsTable<MemberRole, never> = {
  participant: [{ when: [], rights: MEMBER_RIGHTS }],
  council: [
    {
      when: [],
      rights: {
        ...MEMBER_RIGHTS,
        Loan: [...MEMBER_RIGHTS.Loan, 'read:all', 'generate:all'],
        LoanRegistry: ['read'],
      },
    },
  ],
  chairman: [
    {
      when: [],
      rights: {
        Loan: ['cancel:all', 'retry-pay', 'sweep'],
      },
    },
  ],
};

/** Описание прав займов для общего гарда операций и прав страниц стола. */
@Injectable()
export class DebtRights implements AppRights<MemberRole, never>, OnModuleInit {
  readonly extensionName = 'debt';
  readonly table = debtRightsTable;

  constructor(
    @Inject(DESKTOP_GRANTS_REGISTRY_PORT) private readonly grantsRegistry: IDesktopGrantsRegistryPort,
    @Inject(LOAN_REPOSITORY) private readonly loans: LoanRepository
  ) {}

  onModuleInit(): void {
    this.grantsRegistry.register(desktopGrantsOf(this));
  }

  async roles(caller: RightsCaller): Promise<MemberRole[]> {
    return memberRolesOf(caller);
  }

  /** Справочник объектов сверки охвата: заём по хэшу сообщает своего заёмщика. */
  async locate(kind: string, ids: string[]): Promise<RightFacts[]> {
    if (kind !== 'Loan') {
      // i18n-ignore: ошибка разработчика, пайщику не показывается
      throw new Error(`Справочник прав займов не знает объект «${kind}»`);
    }
    const found = await Promise.all(ids.map((id) => this.loans.findByDebtHash(id)));
    return found.filter((loan) => loan !== null).map((loan) => ({ owner: loan?.username ?? null }));
  }
}
