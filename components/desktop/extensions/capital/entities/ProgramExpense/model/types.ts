import type { Queries, Mutations } from '@coopenomics/sdk';

export type IProgramExpense =
  Queries.Capital.GetProgramExpense.IOutput[typeof Queries.Capital.GetProgramExpense.name];
export type IProgramExpensesPagination =
  Queries.Capital.GetProgramExpenses.IOutput[typeof Queries.Capital.GetProgramExpenses.name];

export type IGetProgramExpenseInput = Queries.Capital.GetProgramExpense.IInput;
export type IGetProgramExpensesInput = Queries.Capital.GetProgramExpenses.IInput;

export type IProgramExpenseItem = NonNullable<IProgramExpense>['items'][number];

export type IExpenseProposalAggregate =
  Queries.Expense.ExpenseProposal.IOutput[typeof Queries.Expense.ExpenseProposal.name];
export type IExpenseProposalFile =
  Queries.Expense.ExpenseFilesByProposal.IOutput[typeof Queries.Expense.ExpenseFilesByProposal.name][number];
export type IExpenseRequisite =
  Queries.Expense.ExpenseRequisitesByProposal.IOutput[typeof Queries.Expense.ExpenseRequisitesByProposal.name][number];

export type ICreateProgramExpenseInput =
  Mutations.Capital.CreateProgramExpense.IInput['data'];
export type ICreateProgramExpenseOutput =
  Mutations.Capital.CreateProgramExpense.IOutput[typeof Mutations.Capital.CreateProgramExpense.name];

export type ITopupProgramExpenseInput =
  Mutations.Capital.TopupProgramExpense.IInput['data'];
export type ITopupProgramExpenseOutput =
  Mutations.Capital.TopupProgramExpense.IOutput[typeof Mutations.Capital.TopupProgramExpense.name];
