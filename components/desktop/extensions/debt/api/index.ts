import { client } from 'src/shared/api/client';
import { Mutations, Queries } from '@coopenomics/sdk';

const Q = Queries.Debt;
const M = Mutations.Debt;

export type ILoansInput = Queries.Debt.DebtLoans.IInput;
export type ILoansResult = Queries.Debt.DebtLoans.IOutput[typeof Queries.Debt.DebtLoans.name];
export type ILoan = ILoansResult['items'][number];
export type ICollateralOption =
  Queries.Debt.DebtCollateralOptions.IOutput[typeof Queries.Debt.DebtCollateralOptions.name][number];

export async function getLoans(variables: ILoansInput): Promise<ILoansResult> {
  const { [Q.DebtLoans.name]: result } = await client.Query(Q.DebtLoans.query, { variables });
  return result;
}

export async function getCollateralOptions(coopname: string): Promise<ICollateralOption[]> {
  const { [Q.DebtCollateralOptions.name]: result } = await client.Query(Q.DebtCollateralOptions.query, {
    variables: { coopname },
  });
  return result;
}

const lang = { lang: 'ru' };

export async function generateLoanStatement(data: Mutations.Debt.GenerateDebtLoanStatementDocument.IInput['data']) {
  const { [M.GenerateDebtLoanStatementDocument.name]: result } = await client.Mutation(
    M.GenerateDebtLoanStatementDocument.mutation,
    { variables: { data, options: lang } },
  );
  return result;
}

export async function generateLoanContract(data: Mutations.Debt.GenerateDebtLoanContractDocument.IInput['data']) {
  const { [M.GenerateDebtLoanContractDocument.name]: result } = await client.Mutation(
    M.GenerateDebtLoanContractDocument.mutation,
    { variables: { data, options: lang } },
  );
  return result;
}

export async function generateLoanDecision(data: Mutations.Debt.GenerateDebtLoanDecisionDocument.IInput['data']) {
  const { [M.GenerateDebtLoanDecisionDocument.name]: result } = await client.Mutation(
    M.GenerateDebtLoanDecisionDocument.mutation,
    { variables: { data, options: lang } },
  );
  return result;
}

export async function createLoan(data: Mutations.Debt.CreateDebtLoan.IInput['data']) {
  return client.Mutation(M.CreateDebtLoan.mutation, { variables: { data } });
}

export async function cancelLoan(data: Mutations.Debt.CancelDebtLoan.IInput['data']) {
  return client.Mutation(M.CancelDebtLoan.mutation, { variables: { data } });
}

export async function retryLoanPayment(data: Mutations.Debt.RetryDebtLoanPayment.IInput['data']) {
  return client.Mutation(M.RetryDebtLoanPayment.mutation, { variables: { data } });
}

export async function getRepayAvailable(coopname: string): Promise<string> {
  const { [Q.DebtRepayAvailable.name]: result } = await client.Query(Q.DebtRepayAvailable.query, {
    variables: { coopname },
  });
  return result;
}

export async function generateRepaymentStatement(
  data: Mutations.Debt.GenerateDebtRepaymentStatementDocument.IInput['data'],
) {
  const { [M.GenerateDebtRepaymentStatementDocument.name]: result } = await client.Mutation(
    M.GenerateDebtRepaymentStatementDocument.mutation,
    { variables: { data, options: lang } },
  );
  return result;
}

export async function generateExtensionStatement(
  data: Mutations.Debt.GenerateDebtExtensionStatementDocument.IInput['data'],
) {
  const { [M.GenerateDebtExtensionStatementDocument.name]: result } = await client.Mutation(
    M.GenerateDebtExtensionStatementDocument.mutation,
    { variables: { data, options: lang } },
  );
  return result;
}

export async function repayLoan(data: Mutations.Debt.RepayDebtLoan.IInput['data']) {
  return client.Mutation(M.RepayDebtLoan.mutation, { variables: { data } });
}

export async function extendLoan(data: Mutations.Debt.ExtendDebtLoan.IInput['data']) {
  return client.Mutation(M.ExtendDebtLoan.mutation, { variables: { data } });
}
