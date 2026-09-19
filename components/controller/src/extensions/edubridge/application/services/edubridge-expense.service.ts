import { Inject, Injectable } from '@nestjs/common';
import {
  buildPaginationResult,
  PaginationInputDTO,
  paginationInputToOffset,
  rethrowChainError,
  SignedDigitalDocumentInputDTO,
  type PaginationResult,
} from '@coopenomics/extension-kit';
import {
  EXPENSE_CHASSIS_PORT,
  InnerExpenseItemState,
  InnerExpenseMechanics,
  InnerExpenseProposalState,
  InnerExpenseRecipientType,
  LOGGER_PORT,
  type IExpenseChassisPort,
  type ILoggerPort,
  type InnerExpenseItem,
  type InnerExpenseProposalRead,
} from '@coopenomics/innercoop';
import type { EdubridgeContract } from 'cooptypes';
import { EDUBRIDGE_CHAIN_PORT, type EdubridgeChainPort } from '../../domain/ports/edubridge-chain.port';
import { EdubridgeNamesService } from '../membership/edubridge-names.service';
import type { EduCreateExpenseInputDTO, EduExpenseDTO, EduExpenseItemDTO } from '../dto/edu-expense.dto';

/** Расходы программы ведёт шасси; edubridge — их владелец, по нему они и находятся. */
const OWNER_CONTRACT = 'edubridge';
const OWNER_CALLBACK = 'onexpdone';

/**
 * Расходы ЦПП «Образование». Кооператив тратит собранные взносы на обучение
 * через общее шасси расходов: служебная записка, решение совета, оплата по
 * реквизитам или аванс под отчёт, отчёт с чеками. Расширение выделяет средства
 * фонда под расход и показывает его администратору — само расходов не проводит.
 */
@Injectable()
export class EdubridgeExpenseService {
  constructor(
    @Inject(EDUBRIDGE_CHAIN_PORT) private readonly chain: EdubridgeChainPort,
    @Inject(EXPENSE_CHASSIS_PORT) private readonly expenses: IExpenseChassisPort,
    private readonly names: EdubridgeNamesService,
    @Inject(LOGGER_PORT) private readonly logger: ILoggerPort
  ) {}

  /**
   * Подать расход: реквизиты проверяются до цепи (без них кассир не оплатит),
   * снимок реквизитов снимается после успешной подачи — как в «Столе заказов».
   */
  async create(coopname: string, creator: string, input: EduCreateExpenseInputDTO): Promise<string> {
    const requisiteItems = input.items.map((item) => ({
      proposalHash: input.expense_hash,
      itemHash: item.item_hash,
      recipient: item.recipient_type === InnerExpenseRecipientType.ORG ? '' : item.recipient,
      isOrganization: item.recipient_type === InnerExpenseRecipientType.ORG,
      mechanics: item.mechanics as 'ADVANCE' | 'DIRECT',
      paymentMethodId: item.payment_method_id,
      requisites: item.requisites,
      paymentPurpose: item.payment_purpose,
    }));
    await this.expenses.validateRequisites(coopname, requisiteItems);

    const items = input.items.map((item) => ({
      item_hash: item.item_hash,
      mechanics: item.mechanics === InnerExpenseMechanics.DIRECT ? 1 : 0,
      recipient_type:
        item.recipient_type === InnerExpenseRecipientType.SELF ? 0 : item.recipient_type === InnerExpenseRecipientType.MEMBER ? 1 : 2,
      recipient: item.recipient_type === InnerExpenseRecipientType.ORG ? '' : item.recipient,
      description: item.description,
      planned_amount: item.planned_amount,
      actual_amount: zeroLike(item.planned_amount),
      status: 0,
    }));

    try {
      await this.chain.createExpense({
        coopname,
        creator,
        expense_hash: input.expense_hash,
        items,
        statement: new SignedDigitalDocumentInputDTO(
          input.statement as unknown as SignedDigitalDocumentInputDTO
        ).toDocument() as EdubridgeContract.Actions.CreateExp.ICreateexp['statement'],
      } as EdubridgeContract.Actions.CreateExp.ICreateexp);
    } catch (e) {
      rethrowChainError(e);
    }

    await this.expenses.snapshotRequisites(coopname, requisiteItems);
    this.logger.info(`[EDU.SPEND] ${creator}: расход ${input.expense_hash} подан из фонда программы`);
    return input.expense_hash;
  }

  async list(coopname: string, options?: PaginationInputDTO): Promise<PaginationResult<EduExpenseDTO>> {
    const { limit, offset, sortBy, sortOrder } = paginationInputToOffset(options);
    const allowedSort = sortBy === 'createdAt' || sortBy === 'updatedAt' ? sortBy : undefined;
    const result = await this.expenses.listProposalsByOwner(coopname, OWNER_CONTRACT, OWNER_CALLBACK, {
      limit,
      offset,
      sortBy: allowedSort,
      sortOrder,
    });
    const names = await this.names.displayNames(result.items.flatMap((p) => [p.creator, ...memberRecipients(p)]));
    return buildPaginationResult(result, options, (p) => this.toOutput(p, names));
  }

  private toOutput(p: InnerExpenseProposalRead, names: Map<string, string>): EduExpenseDTO {
    return {
      expense_hash: p.proposalHash,
      creator: p.creator,
      creator_name: names.get(p.creator) ?? p.creator,
      status: PROPOSAL_STATES[p.status] ?? InnerExpenseProposalState.UNDEFINED,
      items: p.items.map((it) => toItem(it, names)),
      total_planned: p.totalPlanned,
      total_actual: p.totalActual,
      created_at: new Date(p.createdAt),
      updated_at: new Date(p.updatedAt),
    };
  }
}

const PROPOSAL_STATES: Record<string, InnerExpenseProposalState> = {
  CREATED: InnerExpenseProposalState.CREATED,
  AUTHORIZED: InnerExpenseProposalState.AUTHORIZED,
  PARTIALLY_PAID: InnerExpenseProposalState.PARTIALLY_PAID,
  REPORT_SUBMITTED: InnerExpenseProposalState.REPORT_SUBMITTED,
  CLOSED: InnerExpenseProposalState.CLOSED,
  DECLINED: InnerExpenseProposalState.DECLINED,
};

// Цепь хранит способ оплаты, получателя и состояние позиции числами — словарь
// шасси переводит их в понятия контракта.
const MECHANICS: InnerExpenseMechanics[] = [InnerExpenseMechanics.ADVANCE, InnerExpenseMechanics.DIRECT];
const RECIPIENTS: InnerExpenseRecipientType[] = [
  InnerExpenseRecipientType.SELF,
  InnerExpenseRecipientType.MEMBER,
  InnerExpenseRecipientType.ORG,
];
const ITEM_STATES: InnerExpenseItemState[] = [
  InnerExpenseItemState.APPROVED,
  InnerExpenseItemState.PAID,
  InnerExpenseItemState.REPORTED,
  InnerExpenseItemState.RETURNED,
  InnerExpenseItemState.OVERSPENT,
];

function toItem(it: InnerExpenseItem, names: Map<string, string>): EduExpenseItemDTO {
  const recipientType = RECIPIENTS[it.recipientType] ?? InnerExpenseRecipientType.ORG;
  return {
    item_hash: it.itemHash,
    mechanics: MECHANICS[it.mechanics] ?? InnerExpenseMechanics.DIRECT,
    recipient_type: recipientType,
    recipient: it.recipient,
    recipient_name: recipientType === InnerExpenseRecipientType.ORG ? it.recipient : (names.get(it.recipient) ?? it.recipient),
    description: it.description,
    planned_amount: it.plannedAmount,
    actual_amount: it.actualAmount,
    status: ITEM_STATES[it.status] ?? InnerExpenseItemState.UNDEFINED,
  };
}

/** Получатели-пайщики расхода: у позиций организации в поле уже её название. */
function memberRecipients(p: InnerExpenseProposalRead): string[] {
  return p.items.filter((it) => RECIPIENTS[it.recipientType] !== InnerExpenseRecipientType.ORG).map((it) => it.recipient);
}

/** Нулевая сумма в той же валюте — шасси ждёт факт нулём до отчёта. */
function zeroLike(amount: string): string {
  const symbol = amount.trim().split(' ')[1] ?? 'RUB';
  return `0.0000 ${symbol}`;
}
