import { Injectable, Inject } from '@nestjs/common';
import { CapitalContract } from 'cooptypes';
import { EXPENSE_CHASSIS_PORT, type IExpenseChassisPort, type InnerExpenseItem, type InnerExpenseProposalRead, type InnerExpenseProposalStatus, type InnerExpenseRequisiteItemInput, ACCOUNT_PORT, type IAccountPort,
  type InnerTransactResult,
  InnerExpenseProposalState,
  InnerExpenseMechanics,
  InnerExpenseRecipientType,
  InnerExpenseItemState,
} from '@coopenomics/innercoop';
import { CapitalBlockchainPort, CAPITAL_BLOCKCHAIN_PORT } from '../../domain/interfaces/capital-blockchain.port';
import { buildPaginationResult, PaginationInputDTO, paginationInputToOffset, type PaginationResult, DomainToBlockchainUtils,
  platformSettings,
} from '@coopenomics/extension-kit';
import type { CreateProgramExpenseInputDTO } from '../dto/program_expenses/create-program-expense.input';
import type { TopupProgramExpenseInputDTO } from '../dto/program_expenses/topup-program-expense.input';
import type {
  ProgramExpenseCallbackOutputDTO,
  ProgramExpenseItemOutputDTO,
  ProgramExpenseOutputDTO,
} from '../dto/program_expenses/program-expense.output';

/**
 * Управление программными расходами Капитала.
 *
 * Тонкое расширение: write — `capital::createpgexp` / `topupprogexp` через
 * `CapitalBlockchainPort`; read — через inter-порт `EXPENSE_CHASSIS_PORT`
 * (шасси-extension отвечает за хранение proposals).
 */
@Injectable()
export class ProgramExpensesManagementService {
  constructor(
    @Inject(CAPITAL_BLOCKCHAIN_PORT)
    private readonly capitalBlockchainPort: CapitalBlockchainPort,
    @Inject(EXPENSE_CHASSIS_PORT)
    private readonly expenseChassis: IExpenseChassisPort,
    @Inject(ACCOUNT_PORT)
    private readonly accountDataPort: IAccountPort,
    private readonly domainToBlockchainUtils: DomainToBlockchainUtils,
  ) {}

  async createProgramExpense(data: CreateProgramExpenseInputDTO): Promise<InnerTransactResult> {
    // Реквизиты получателей: валидация ДО on-chain заявки, снимок в шасси —
    // ПОСЛЕ (фиксация «куда платить» на момент создания СЗ).
    const requisiteItems: InnerExpenseRequisiteItemInput[] = data.items.map((it) => ({
      proposalHash: data.expense_hash,
      itemHash: it.item_hash,
      recipient: it.recipient,
      isOrganization: it.recipient_type === InnerExpenseRecipientType.ORG,
      mechanics: it.mechanics === InnerExpenseMechanics.DIRECT ? 'DIRECT' : 'ADVANCE',
      paymentMethodId: it.payment_method_id,
      requisites: it.requisites,
      paymentPurpose: it.payment_purpose,
    }));
    await this.expenseChassis.validateRequisites(data.coopname, requisiteItems);

    const zeroAmount = `0.0000 ${platformSettings().blockchain.rootGovernSymbol}`;
    const blockchainData: CapitalContract.Actions.CreateProgramExpense.ICreateProgramExpense = {
      coopname: data.coopname,
      expense_hash: data.expense_hash,
      creator: data.creator,
      items: data.items.map((it) => ({
        item_hash: it.item_hash,
        mechanics: it.mechanics === InnerExpenseMechanics.DIRECT ? 1 : 0,
        recipient_type:
          it.recipient_type === InnerExpenseRecipientType.SELF
            ? 0
            : it.recipient_type === InnerExpenseRecipientType.MEMBER
              ? 1
              : 2,
        recipient: it.recipient,
        description: it.description,
        planned_amount: it.planned_amount,
        actual_amount: zeroAmount,
        status: 0,
      })),
      description: data.description,
      statement: this.domainToBlockchainUtils.convertSignedDocumentToBlockchainFormat(data.statement),
    };
    const result = await this.capitalBlockchainPort.createProgramExpense(blockchainData);

    await this.expenseChassis.snapshotRequisites(data.coopname, requisiteItems);

    return result;
  }

  async topupProgramExpense(data: TopupProgramExpenseInputDTO): Promise<InnerTransactResult> {
    return this.capitalBlockchainPort.topupProgramExpense({
      coopname: data.coopname,
      amount: data.amount,
    });
  }

  async listProgramExpenses(
    coopname: string,
    options?: PaginationInputDTO,
  ): Promise<PaginationResult<ProgramExpenseOutputDTO>> {
    const { limit, offset, sortBy, sortOrder } = paginationInputToOffset(options);
    const allowedSort = sortBy === 'createdAt' || sortBy === 'updatedAt' ? sortBy : undefined;

    const result = await this.expenseChassis.listProposalsByOwner(coopname, 'capital', 'onpgexpdone', {
      limit,
      offset,
      sortBy: allowedSort,
      sortOrder,
    });

    const names = await this.resolveDisplayNames(
      result.items.flatMap((p) => [p.creator, ...this.memberRecipients(p)]),
    );
    return buildPaginationResult(result, options, (p) => this.toOutput(p, names));
  }

  async getProgramExpense(coopname: string, expenseHash: string): Promise<ProgramExpenseOutputDTO | null> {
    const proposal = await this.expenseChassis.readProposalByHash(coopname, expenseHash);
    if (!proposal) return null;
    const names = await this.resolveDisplayNames([proposal.creator, ...this.memberRecipients(proposal)]);
    return this.toOutput(proposal, names);
  }

  /** Получатели-пайщики СЗ (у ORG-строк recipient — уже название организации). */
  private memberRecipients(p: InnerExpenseProposalRead): string[] {
    return p.items
      .filter((it) => this.mapRecipientType(it.recipientType) !== InnerExpenseRecipientType.ORG)
      .map((it) => it.recipient);
  }

  /** ФИО/название организации по username; при ошибке резолва остаётся username. */
  private async resolveDisplayNames(usernames: string[]): Promise<Map<string, string>> {
    const unique = [...new Set(usernames.filter(Boolean))];
    const entries = await Promise.all(
      unique.map(async (username): Promise<[string, string]> => {
        try {
          const displayName = await this.accountDataPort.getDisplayName(username);
          return [username, displayName || username];
        } catch {
          return [username, username];
        }
      }),
    );
    return new Map(entries);
  }

  private toOutput(p: InnerExpenseProposalRead, names: Map<string, string>): ProgramExpenseOutputDTO {
    return {
      coopname: p.coopname,
      expense_hash: p.proposalHash,
      creator: p.creator,
      creator_name: names.get(p.creator) ?? p.creator,
      source_wallet: p.sourceWalletCode,
      status: this.mapStatus(p.status),
      callback: p.callback ? this.toCallbackOutput(p.callback) : undefined,
      items: p.items.map((it) => this.toItemOutput(it, names)),
      total_planned: p.totalPlanned,
      total_actual: p.totalActual,
      created_at: p.createdAt,
      updated_at: p.updatedAt,
    };
  }

  private toItemOutput(it: InnerExpenseItem, names: Map<string, string>): ProgramExpenseItemOutputDTO {
    const recipientType = this.mapRecipientType(it.recipientType);
    return {
      item_hash: it.itemHash,
      mechanics: this.mapMechanics(it.mechanics),
      recipient_type: recipientType,
      recipient: it.recipient,
      recipient_name:
        recipientType === InnerExpenseRecipientType.ORG
          ? it.recipient
          : (names.get(it.recipient) ?? it.recipient),
      description: it.description,
      planned_amount: it.plannedAmount,
      actual_amount: it.actualAmount,
      status: this.mapItemStatus(it.status),
    };
  }

  private toCallbackOutput(cb: { contract: string; action: string; data: string }): ProgramExpenseCallbackOutputDTO {
    return { contract: cb.contract, action: cb.action, data: cb.data };
  }

  private mapStatus(status: InnerExpenseProposalStatus): InnerExpenseProposalState {
    switch (status) {
      case 'CREATED':
        return InnerExpenseProposalState.CREATED;
      case 'AUTHORIZED':
        return InnerExpenseProposalState.AUTHORIZED;
      case 'PARTIALLY_PAID':
        return InnerExpenseProposalState.PARTIALLY_PAID;
      case 'REPORT_SUBMITTED':
        return InnerExpenseProposalState.REPORT_SUBMITTED;
      case 'CLOSED':
        return InnerExpenseProposalState.CLOSED;
      case 'DECLINED':
        return InnerExpenseProposalState.DECLINED;
      default:
        return InnerExpenseProposalState.UNDEFINED;
    }
  }

  private mapMechanics(raw: number): InnerExpenseMechanics {
    return raw === 1 ? InnerExpenseMechanics.DIRECT : InnerExpenseMechanics.ADVANCE;
  }

  private mapRecipientType(raw: number): InnerExpenseRecipientType {
    if (raw === 2) return InnerExpenseRecipientType.ORG;
    if (raw === 1) return InnerExpenseRecipientType.MEMBER;
    return InnerExpenseRecipientType.SELF;
  }

  private mapItemStatus(raw: number): InnerExpenseItemState {
    switch (raw) {
      case 0:
        return InnerExpenseItemState.APPROVED;
      case 1:
        return InnerExpenseItemState.PAID;
      case 2:
        return InnerExpenseItemState.REPORTED;
      case 3:
        return InnerExpenseItemState.RETURNED;
      case 4:
        return InnerExpenseItemState.OVERSPENT;
      default:
        return InnerExpenseItemState.UNDEFINED;
    }
  }
}
