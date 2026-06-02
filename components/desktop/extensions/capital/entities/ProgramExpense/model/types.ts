import type { Queries, Mutations } from '@coopenomics/sdk';

export type IProgramExpense =
  Queries.Capital.GetProgramExpense.IOutput[typeof Queries.Capital.GetProgramExpense.name];
export type IProgramExpensesPagination =
  Queries.Capital.GetProgramExpenses.IOutput[typeof Queries.Capital.GetProgramExpenses.name];

export type IGetProgramExpenseInput = Queries.Capital.GetProgramExpense.IInput['data'];
export type IGetProgramExpensesInput = Queries.Capital.GetProgramExpenses.IInput;

export type ICreateProgramExpenseInput = Mutations.Capital.CreateProgramExpense.IInput['data'];
export type IApproveProgramExpenseInput = Mutations.Capital.ApproveProgramExpense.IInput['data'];
export type IAuthorizeProgramExpenseInput = Mutations.Capital.AuthorizeProgramExpense.IInput['data'];
export type IConfirmProgramExpensePaymentInput =
  Mutations.Capital.ConfirmProgramExpensePayment.IInput['data'];
export type IDeclineProgramExpenseInput = Mutations.Capital.DeclineProgramExpense.IInput['data'];
export type ITopupProgramExpensePoolInput = Mutations.Capital.TopupProgramExpensePool.IInput['data'];

export type IProgramExpenseTransactionOutput =
  Mutations.Capital.CreateProgramExpense.IOutput[typeof Mutations.Capital.CreateProgramExpense.name];
