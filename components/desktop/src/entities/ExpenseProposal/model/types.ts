import type { Queries } from '@coopenomics/sdk';

export type IGetExpenseProposalsByCooperativeInput = Queries.Expense.ExpenseProposalsByCooperative.IInput;

export type IExpenseProposalsByCooperativeResult =
  Queries.Expense.ExpenseProposalsByCooperative.IOutput[typeof Queries.Expense.ExpenseProposalsByCooperative.name];

export type IGetExpenseAdvancesByCooperativeInput = Queries.Expense.ExpenseAdvancesByCooperative.IInput;

export type IExpenseAdvancesByCooperativeResult =
  Queries.Expense.ExpenseAdvancesByCooperative.IOutput[typeof Queries.Expense.ExpenseAdvancesByCooperative.name];

/** Выданный аванс под отчёт — строка страницы «Авансы» стола кассира. */
export type IExpenseAdvanceRow = NonNullable<IExpenseAdvancesByCooperativeResult['items']>[number];

/** Строка списка служебных записок (реестр, касса, авансы — одна выборка). */
export type IExpenseProposalRow = NonNullable<IExpenseProposalsByCooperativeResult['items']>[number];
