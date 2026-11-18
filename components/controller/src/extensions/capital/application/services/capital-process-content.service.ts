import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import {
  contentAsset,
  contentDay,
  contentFact,
  platformSettings,
  processContentRegistry,
  type ProcessContentDTO,
  type ProcessContentProvider,
} from '@coopenomics/extension-kit';
import { ACCOUNT_PORT, type IAccountPort } from '@coopenomics/innercoop';
import { DEBT_REPOSITORY, type DebtRepository } from '../../domain/repositories/debt.repository';
import {
  PROGRAM_PROPERTY_REPOSITORY,
  type ProgramPropertyRepository,
} from '../../domain/repositories/program-property.repository';
import { RESULT_REPOSITORY, type ResultRepository } from '../../domain/repositories/result.repository';
import { PROGRAM_WITHDRAW_REPOSITORY } from '../../domain/repositories/program-withdraw.repository';
import type { ProgramWithdrawRepository } from '../../domain/repositories/program-withdraw.repository';
import { CONTRIBUTOR_REPOSITORY, type ContributorRepository } from '../../domain/repositories/contributor.repository';
import { t } from '../../i18n';

/** Процессы Благороста и сущность каждого: хэш процесса — ключ записи. */
const DEBT = 'p.cap.debt'; // i18n-ignore
const PROPERTY = 'p.cap.prop'; // i18n-ignore
const RID = 'p.cap.rid'; // i18n-ignore
const WITHDRAW = 'p.cap.wthcap'; // i18n-ignore
const INVEST = 'p.cap.invest'; // i18n-ignore
const IMPORT = 'p.cap.import'; // i18n-ignore

/**
 * Содержание процессов ЦПП «Благорост» для стола бухгалтера: кто пайщик,
 * какое имущество или результат, какая сумма займа или возврата. Учёт и
 * документы процесса стол показывает сам.
 */
@Injectable()
export class CapitalProcessContentService implements OnModuleInit, ProcessContentProvider {
  constructor(
    @Inject(DEBT_REPOSITORY) private readonly debts: DebtRepository,
    @Inject(PROGRAM_PROPERTY_REPOSITORY) private readonly properties: ProgramPropertyRepository,
    @Inject(RESULT_REPOSITORY) private readonly results: ResultRepository,
    @Inject(PROGRAM_WITHDRAW_REPOSITORY) private readonly withdraws: ProgramWithdrawRepository,
    @Inject(CONTRIBUTOR_REPOSITORY) private readonly contributors: ContributorRepository,
    @Inject(ACCOUNT_PORT) private readonly accounts: IAccountPort
  ) {}

  onModuleInit(): void {
    processContentRegistry.register([DEBT, PROPERTY, RID, WITHDRAW, INVEST, IMPORT], this);
  }

  async content(processHash: string, _coopname: string, processType: string): Promise<ProcessContentDTO | null> {
    const describe = this.handlers[processType];
    return describe ? describe(processHash.toLowerCase()) : null;
  }

  /** Описание по типу процесса: хэш процесса — ключ записи сущности. */
  private readonly handlers: Record<string, (_hash: string) => Promise<ProcessContentDTO | null>> = {
    [DEBT]: (hash) => this.debt(hash),
    [PROPERTY]: (hash) => this.property(hash),
    [RID]: (hash) => this.rid(hash),
    [WITHDRAW]: (hash) => this.withdraw(hash),
    [INVEST]: (hash) => this.contributor(hash),
    [IMPORT]: (hash) => this.contributor(hash),
  };

  private async debt(hash: string): Promise<ProcessContentDTO | null> {
    const debt = await this.debts.findBySyncKey('debt_hash', hash);
    if (!debt) return null;
    return this.card(null, debt.username, debt.amount, 'debt', [
      ...contentFact(t('capital.processContent.repaidAt'), contentDay(debt.repaid_at)),
      ...contentFact(t('capital.processContent.memo'), debt.memo),
    ]);
  }

  private async property(hash: string): Promise<ProcessContentDTO | null> {
    const property = await this.properties.findBySyncKey('property_hash', hash);
    if (!property) return null;
    const title = property.property_description || t('capital.processContent.property.title');
    return this.card(title, property.username, property.property_amount, 'property', [
      ...contentFact(t('capital.processContent.createdAt'), contentDay(property.created_at)),
    ]);
  }

  private async rid(hash: string): Promise<ProcessContentDTO | null> {
    const result = await this.results.findBySyncKey('result_hash', hash);
    if (!result) return null;
    return this.card(null, result.username, result.total_amount, 'rid', [
      ...contentFact(t('capital.processContent.createdAt'), contentDay(result.created_at)),
    ]);
  }

  private async withdraw(hash: string): Promise<ProcessContentDTO | null> {
    const withdraw = await this.withdraws.findBySyncKey('withdraw_hash', hash);
    if (!withdraw) return null;
    return this.card(null, withdraw.username, withdraw.amount, 'withdraw', [
      ...contentFact(t('capital.processContent.createdAt'), contentDay(withdraw.created_at)),
    ]);
  }

  private async contributor(hash: string): Promise<ProcessContentDTO | null> {
    const contributor = await this.contributors.findBySyncKey('contributor_hash', hash);
    if (!contributor) return null;
    return this.card(null, contributor.username, null, 'contributor', [
      ...contentFact(t('capital.processContent.contributor.asInvestor'), contributor.contributed_as_investor),
      ...contentFact(t('capital.processContent.contributor.asCreator'), contributor.contributed_as_creator),
    ]);
  }

  /** Общая карточка: предмет, пайщик, главная сумма и сведения процесса. */
  private async card(
    /** Предмет процесса; без своего названия карточку называет пайщик. */
    title: string | null,
    username: string | undefined,
    amount: string | null | undefined,
    kind: string,
    facts: ProcessContentDTO['facts']
  ): Promise<ProcessContentDTO> {
    const { rootGovernSymbol: symbol, rootGovernPrecision: precision } = platformSettings().blockchain;
    const participant = username ? await this.nameOf(username) : '';
    return {
      title: title ?? participant,
      subtitle: title ? participant || null : null,
      image_url: null,
      amount: contentAsset(amount, symbol, precision),
      amount_label: t(`capital.processContent.${kind}.amountLabel`),
      status: null,
      facts: title ? [...contentFact(t('capital.processContent.participant'), participant), ...facts] : facts,
      links: [],
    };
  }

  /** ФИО пайщика или название организации; без имени — учётное имя. */
  private async nameOf(account: string): Promise<string> {
    try {
      return (await this.accounts.getDisplayName(account)) || account;
    } catch {
      return account;
    }
  }
}
