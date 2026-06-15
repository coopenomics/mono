import { Injectable, Inject } from '@nestjs/common';
import { CapitalContract } from 'cooptypes';
import type { TransactResult } from '@wharfkit/session';
import { config } from '~/config';
import {
  INTER_EXPENSE_CHASSIS,
  type InterExpenseChassisPort,
  type InterExpenseItem,
  type InterExpenseProposalRead,
  type InterExpenseProposalStatus,
  type InterExpenseRequisiteItemInput,
} from '@coopenomics/inter';
import { AccountDataPort, ACCOUNT_DATA_PORT } from '~/domain/account/ports/account-data.port';
import { CapitalBlockchainPort, CAPITAL_BLOCKCHAIN_PORT } from '../../domain/interfaces/capital-blockchain.port';
import { DomainToBlockchainUtils } from '~/shared/utils/domain-to-blockchain.utils';
import {
  buildPaginationResult,
  PaginationInputDTO,
  paginationInputToOffset,
  type PaginationResult,
} from '~/application/common/dto/pagination.dto';
import type { CreateProgramExpenseInputDTO } from '../dto/program_expenses/create-program-expense.input';
import type { TopupProgramExpenseInputDTO } from '../dto/program_expenses/topup-program-expense.input';
import type {
  ProgramExpenseCallbackOutputDTO,
  ProgramExpenseItemOutputDTO,
  ProgramExpenseOutputDTO,
} from '../dto/program_expenses/program-expense.output';
import { ExpenseProposalStatus } from '~/extensions/expenses/domain/enums/expense-proposal-status.enum';
import { ExpenseMechanics } from '~/extensions/expenses/domain/enums/expense-mechanics.enum';
import { ExpenseRecipientType } from '~/extensions/expenses/domain/enums/expense-recipient-type.enum';
import { ExpenseItemStatus } from '~/extensions/expenses/domain/enums/expense-item-status.enum';

/**
 * Управление программными расходами Капитала.
 *
 * Тонкое расширение: write — `capital::createpgexp` / `topupprogexp` через
 * `CapitalBlockchainPort`; read — через inter-порт `INTER_EXPENSE_CHASSIS`
 * (шасси-extension отвечает за хранение proposals).
 */
@Injectable()
export class ProgramExpensesManagementService {
  constructor(
    @Inject(CAPITAL_BLOCKCHAIN_PORT)
    private readonly capitalBlockchainPort: CapitalBlockchainPort,
    @Inject(INTER_EXPENSE_CHASSIS)
    private readonly expenseChassis: InterExpenseChassisPort,
    @Inject(ACCOUNT_DATA_PORT)
    private readonly accountDataPort: AccountDataPort,
    private readonly domainToBlockchainUtils: DomainToBlockchainUtils,
  ) {}

  async createProgramExpense(data: CreateProgramExpenseInputDTO): Promise<TransactResult> {
    // Реквизиты получателей: валидация ДО on-chain заявки, снимок в шасси —
    // ПОСЛЕ (фиксация «куда платить» на момент создания СЗ).
    const requisiteItems: InterExpenseRequisiteItemInput[] = data.items.map((it) => ({
      proposalHash: data.expense_hash,
      itemHash: it.item_hash,
      recipient: it.recipient,
      isOrganization: it.recipient_type === ExpenseRecipientType.ORG,
      mechanics: it.mechanics === ExpenseMechanics.DIRECT ? 'DIRECT' : 'ADVANCE',
      paymentMethodId: it.payment_method_id,
      requisites: it.requisites,
      paymentPurpose: it.payment_purpose,
    }));
    await this.expenseChassis.validateRequisites(data.coopname, requisiteItems);

    const zeroAmount = `0.0000 ${config.blockchain.root_govern_symbol}`;
    const blockchainData: CapitalContract.Actions.CreateProgramExpense.ICreateProgramExpense = {
      coopname: data.coopname,
      expense_hash: data.expense_hash,
      creator: data.creator,
      items: data.items.map((it) => ({
        item_hash: it.item_hash,
        mechanics: it.mechanics === ExpenseMechanics.DIRECT ? 1 : 0,
        recipient_type:
          it.recipient_type === ExpenseRecipientType.SELF
            ? 0
            : it.recipient_type === ExpenseRecipientType.MEMBER
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

  async topupProgramExpense(data: TopupProgramExpenseInputDTO): Promise<TransactResult> {
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
  private memberRecipients(p: InterExpenseProposalRead): string[] {
    return p.items
      .filter((it) => this.mapRecipientType(it.recipientType) !== ExpenseRecipientType.ORG)
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

  private toOutput(p: InterExpenseProposalRead, names: Map<string, string>): ProgramExpenseOutputDTO {
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

  private toItemOutput(it: InterExpenseItem, names: Map<string, string>): ProgramExpenseItemOutputDTO {
    const recipientType = this.mapRecipientType(it.recipientType);
    return {
      item_hash: it.itemHash,
      mechanics: this.mapMechanics(it.mechanics),
      recipient_type: recipientType,
      recipient: it.recipient,
      recipient_name:
        recipientType === ExpenseRecipientType.ORG
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

  private mapStatus(status: InterExpenseProposalStatus): ExpenseProposalStatus {
    switch (status) {
      case 'CREATED':
        return ExpenseProposalStatus.CREATED;
      case 'AUTHORIZED':
        return ExpenseProposalStatus.AUTHORIZED;
      case 'PARTIALLY_PAID':
        return ExpenseProposalStatus.PARTIALLY_PAID;
      case 'REPORT_SUBMITTED':
        return ExpenseProposalStatus.REPORT_SUBMITTED;
      case 'CLOSED':
        return ExpenseProposalStatus.CLOSED;
      case 'DECLINED':
        return ExpenseProposalStatus.DECLINED;
      default:
        return ExpenseProposalStatus.UNDEFINED;
    }
  }

  private mapMechanics(raw: number): ExpenseMechanics {
    return raw === 1 ? ExpenseMechanics.DIRECT : ExpenseMechanics.ADVANCE;
  }

  private mapRecipientType(raw: number): ExpenseRecipientType {
    if (raw === 2) return ExpenseRecipientType.ORG;
    if (raw === 1) return ExpenseRecipientType.MEMBER;
    return ExpenseRecipientType.SELF;
  }

  private mapItemStatus(raw: number): ExpenseItemStatus {
    switch (raw) {
      case 0:
        return ExpenseItemStatus.APPROVED;
      case 1:
        return ExpenseItemStatus.PAID;
      case 2:
        return ExpenseItemStatus.REPORTED;
      case 3:
        return ExpenseItemStatus.RETURNED;
      case 4:
        return ExpenseItemStatus.OVERSPENT;
      default:
        return ExpenseItemStatus.UNDEFINED;
    }
  }
}
