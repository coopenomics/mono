import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import {
  contentAsset,
  contentDay,
  contentFact,
  contentMoney,
  platformSettings,
  processContentRegistry,
  type ProcessContentDTO,
  type ProcessContentProvider,
} from '@coopenomics/extension-kit';
import { ACCOUNT_PORT, type IAccountPort } from '@coopenomics/innercoop';
import { Ledger2 } from 'cooptypes';
import {
  EXPENSE_PROPOSAL_REPOSITORY,
  type ExpenseProposalRepository,
} from '../../domain/repositories/expense-proposal.repository';
import { t, te } from '../../i18n';

/**
 * Процессы, расход которых ведёт шасси расходов: процесс приложения знает
 * свою записку по хэшу процесса — он же хэш записки. Расход кооператива,
 * расход участка, расход ЦПП «Образование» и расход по служебной записке.
 */
const CHASSIS_PROCESSES = Ledger2.LEDGER2_PROCESS_REGISTRY
  .filter((p) => p.type === 'p.exp.expns' || p.name === 'SPEND') // i18n-ignore
  .map((p) => p.type);

/** Название кошелька-источника из реестра кошельков: «Общий кошелёк участка». */
function walletName(wallet: string | undefined): string {
  if (!wallet) return '';
  return Ledger2.LEDGER2_WALLET_REGISTRY.find((w) => w.name === wallet)?.human_name ?? wallet;
}

/**
 * Содержание расхода для стола бухгалтера: на что расход, кому платить,
 * сколько запланировано и сколько потрачено, из какого кошелька. Учёт и
 * документы записки стол показывает сам.
 */
@Injectable()
export class ExpenseProcessContentService implements OnModuleInit, ProcessContentProvider {
  constructor(
    @Inject(EXPENSE_PROPOSAL_REPOSITORY) private readonly proposals: ExpenseProposalRepository,
    @Inject(ACCOUNT_PORT) private readonly accounts: IAccountPort
  ) {}

  onModuleInit(): void {
    processContentRegistry.register(CHASSIS_PROCESSES, this);
  }

  async content(processHash: string): Promise<ProcessContentDTO | null> {
    const proposal = await this.proposals.findByProposalHash(processHash.toLowerCase());
    if (!proposal) return null;
    const { rootGovernSymbol: symbol, rootGovernPrecision: precision } = platformSettings().blockchain;
    const items = proposal.items ?? [];
    const statusKey = `expenses.processContent.status.${proposal.status}`;
    const recipients = await Promise.all(items.map((item) => this.nameOf(item.recipient)));
    return {
      title: items[0]?.description || t('expenses.processContent.untitled'),
      subtitle: items.length > 1 ? t('expenses.processContent.items', { count: items.length }) : null,
      image_url: null,
      amount: contentAsset(proposal.total_planned, symbol, precision),
      amount_label: t('expenses.processContent.planned'),
      status: te(statusKey) ? t(statusKey) : String(proposal.status),
      facts: [
        ...contentFact(t('expenses.processContent.author'), proposal.username ? await this.nameOf(proposal.username) : ''),
        ...contentFact(t('expenses.processContent.source'), walletName(proposal.source_wallet)),
        ...items.map((item, index) => ({
          label: item.description || t('expenses.processContent.untitled'),
          value: t('expenses.processContent.itemValue', {
            recipient: recipients[index],
            amount: contentMoney(item.planned_amount, symbol),
          }),
        })),
        ...contentFact(t('expenses.processContent.actual'), contentMoney(proposal.total_actual, symbol)),
        ...contentFact(t('expenses.processContent.createdAt'), contentDay(proposal.created_at)),
      ],
      links: [],
    };
  }

  /** ФИО или название получателя; без имени — как записано в записке. */
  private async nameOf(account: string | undefined): Promise<string> {
    if (!account) return '';
    try {
      return (await this.accounts.getDisplayName(account)) || account;
    } catch {
      return account;
    }
  }
}
