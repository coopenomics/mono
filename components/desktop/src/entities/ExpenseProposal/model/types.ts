import type { Queries } from '@coopenomics/sdk';

export type IGetExpenseProposalsByCooperativeInput = Queries.Expense.ExpenseProposalsByCooperative.IInput;

export type IExpenseProposalsByCooperativeResult =
  Queries.Expense.ExpenseProposalsByCooperative.IOutput[typeof Queries.Expense.ExpenseProposalsByCooperative.name];

export type IGetExpenseAdvancesByMemberInput = Queries.Expense.ExpenseAdvancesByMember.IInput;

export type IExpenseAdvancesByMemberResult =
  Queries.Expense.ExpenseAdvancesByMember.IOutput[typeof Queries.Expense.ExpenseAdvancesByMember.name];

/** Строка списка служебных записок (реестр, касса, авансы — одна выборка). */
export type IExpenseProposalRow = NonNullable<IExpenseProposalsByCooperativeResult['items']>[number];
