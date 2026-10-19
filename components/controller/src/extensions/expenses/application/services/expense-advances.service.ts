import { Inject, Injectable } from '@nestjs/common';
import { type PaginationInputDTO, type PaginationResult } from '@coopenomics/extension-kit';
import {
  ACCOUNT_PORT,
  PAYMENT_PORT,
  PaymentStatus,
  PaymentType,
  type IAccountPort,
  type InnerPayment,
  type IPaymentPort,
} from '@coopenomics/innercoop';
import {
  EXPENSE_PROPOSAL_REPOSITORY,
  type ExpenseProposalRepository,
  type IExpenseAdvanceQuery,
  type IExpenseAdvanceRow,
} from '../../domain/repositories/expense-proposal.repository';
import { ExpenseAdvanceState } from '../../domain/enums/expense-advance-state.enum';
import { ExpenseChainItemStatus } from '../../domain/enums/expense-item-status.enum';
import type { ExpenseAdvanceOutputDTO } from '../dto/expense-advance.output';
import type { ExpenseAdvancesFilterInputDTO } from '../dto/expense-advances-filter.input';

/** Платёжки расчёта разницы по авансу: возврат остатка и доплата перерасхода. */
const SETTLEMENT_TYPES = [PaymentType.EXPENSE_RETURN, PaymentType.EXPENSE_OVERSPEND];

/** Платёжка расчёта ещё не проведена: касса её не подтвердила либо проводка идёт. */
const SETTLEMENT_OPEN = new Set<PaymentStatus>([PaymentStatus.PENDING, PaymentStatus.PROCESSING, PaymentStatus.PAID]);

const SETTLEMENT_PAGE = 100;

/**
 * Выданные авансы под отчёт по кооперативу — страница «Авансы» стола кассира.
 *
 * Строка-аванс живёт в записке; возврат остатка и доплата статус строки в
 * цепи не меняют (она остаётся оплаченной до отчёта), поэтому «возврат или
 * доплата» узнаётся по открытой платёжке расчёта в реестре платежей. Дата
 * выдачи и заявленный факт — из платежа выдачи аванса (его хеш равен хешу
 * строки).
 */
@Injectable()
export class ExpenseAdvancesService {
  constructor(
    @Inject(EXPENSE_PROPOSAL_REPOSITORY) private readonly proposals: ExpenseProposalRepository,
    @Inject(PAYMENT_PORT) private readonly payments: IPaymentPort,
    @Inject(ACCOUNT_PORT) private readonly accounts: IAccountPort
  ) {}

  async list(
    coopname: string,
    filter: ExpenseAdvancesFilterInputDTO | undefined,
    options?: PaginationInputDTO
  ): Promise<PaginationResult<ExpenseAdvanceOutputDTO>> {
    const settling = await this.settlingItems(coopname);
    const { items, totalCount } = await this.proposals.findAdvances(coopname, queryFor(filter?.state, settling), options);
    const names = new Map<string, Promise<string>>();
    const rows = await Promise.all(items.map((row) => this.present(row, settling, names)));
    const limit = Math.max(1, Math.min(200, options?.limit ?? 10));
    return {
      items: rows,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
      currentPage: Math.max(1, options?.page ?? 1),
    };
  }

  /** Хеши строк-авансов с открытой платёжкой расчёта разницы. */
  async settlingItems(coopname: string): Promise<Set<string>> {
    const out = new Set<string>();
    for (const type of SETTLEMENT_TYPES) {
      for (let page = 1; ; page++) {
        const found = await this.payments.list({ coopname, type }, { page, limit: SETTLEMENT_PAGE, sortOrder: 'DESC' });
        for (const payment of found.items) {
          const itemHash = (payment.blockchain_data as { item_hash?: string } | undefined)?.item_hash;
          if (itemHash && SETTLEMENT_OPEN.has(payment.status)) out.add(itemHash.toLowerCase());
        }
        if (page >= found.totalPages) break;
      }
    }
    return out;
  }

  private async present(
    row: IExpenseAdvanceRow,
    settling: ReadonlySet<string>,
    names: Map<string, Promise<string>>
  ): Promise<ExpenseAdvanceOutputDTO> {
    const itemHash = row.item.item_hash.toLowerCase();
    const state = stateOf(row.item.status, settling.has(itemHash));
    const payment = await this.payments.findByHash(itemHash);
    const name = names.get(row.item.recipient) ?? this.nameOf(row.item.recipient);
    names.set(row.item.recipient, name);
    return {
      proposal_hash: row.proposal_hash.toLowerCase(),
      item_hash: itemHash,
      recipient: row.item.recipient,
      recipient_name: await name,
      description: row.item.description,
      advance_amount: row.item.planned_amount,
      spent_amount: spentOf(state, row.item.actual_amount, payment),
      state,
      issued_at: payment ? (payment.completed_at ?? payment.updated_at ?? null) : null,
    };
  }

  /** ФИО получателя; учётная запись без данных показывается учётным именем. */
  private async nameOf(username: string): Promise<string> {
    try {
      return (await this.accounts.getDisplayName(username)) || username;
    } catch {
      return username;
    }
  }
}

/** Отбор строк по состоянию: выданные — оплаченные и отчитанные строки. */
export function queryFor(state: ExpenseAdvanceState | undefined, settling: ReadonlySet<string>): IExpenseAdvanceQuery {
  const open = [...settling];
  switch (state) {
    case ExpenseAdvanceState.AWAITING_REPORT:
      return { statuses: [ExpenseChainItemStatus.PAID], exceptItems: open };
    case ExpenseAdvanceState.SETTLEMENT:
      return { statuses: [ExpenseChainItemStatus.PAID], onlyItems: open };
    case ExpenseAdvanceState.REPORTED:
      return { statuses: [ExpenseChainItemStatus.REPORTED] };
    default:
      return { statuses: [ExpenseChainItemStatus.PAID, ExpenseChainItemStatus.REPORTED] };
  }
}

export function stateOf(status: number, settling: boolean): ExpenseAdvanceState {
  if (status === ExpenseChainItemStatus.REPORTED) return ExpenseAdvanceState.REPORTED;
  return settling ? ExpenseAdvanceState.SETTLEMENT : ExpenseAdvanceState.AWAITING_REPORT;
}

/**
 * Фактически потрачено: после отчёта — итог строки в цепи; пока идёт расчёт
 * разницы — сумма, заявленная получателем в отчёте; до отчёта — пусто.
 */
export function spentOf(state: ExpenseAdvanceState, actual: string, payment: InnerPayment | null): string | null {
  if (state === ExpenseAdvanceState.REPORTED) return actual;
  if (state === ExpenseAdvanceState.SETTLEMENT) {
    return (payment?.blockchain_data as { reported_amount?: string } | undefined)?.reported_amount ?? null;
  }
  return null;
}
