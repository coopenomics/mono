import type { Queries } from '@coopenomics/sdk';

/** Заявка шасси расходов целиком: позиции, документы, состояние. */
export type ExpenseProposalAggregate = NonNullable<Queries.Expense.ExpenseProposal.IOutput[typeof Queries.Expense.ExpenseProposal.name]>;
export type ExpenseProposalItem = ExpenseProposalAggregate['items'][number];
export type ExpenseProposalFile = Queries.Expense.ExpenseFilesByProposal.IOutput[typeof Queries.Expense.ExpenseFilesByProposal.name][number];
export type ExpenseProposalRequisite = Queries.Expense.ExpenseRequisitesByProposal.IOutput[typeof Queries.Expense.ExpenseRequisitesByProposal.name][number];

export interface ExpenseProposalDetailsProps {
  /** Хэш заявки (служебной записки) в шасси расходов. */
  expenseHash: string;
  /** ФИО инициатора: шасси знает только учётное имя, имя подаёт пул (Благорост, программа). */
  creatorName?: string | null;
  /** Имена получателей по позициям, если пул их знает: `item_hash → имя`. */
  recipientNames?: Record<string, string>;
}
