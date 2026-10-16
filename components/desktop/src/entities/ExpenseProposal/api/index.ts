import { client } from 'src/shared/api/client';
import { Queries } from '@coopenomics/sdk';
import type {
  IExpenseAdvancesByCooperativeResult,
  IExpenseProposalsByCooperativeResult,
  IGetExpenseAdvancesByCooperativeInput,
  IGetExpenseProposalsByCooperativeInput,
} from '../model/types';

/** Служебные записки кооператива — реестр расходов и касса. */
async function loadProposalsByCooperative(
  data: IGetExpenseProposalsByCooperativeInput,
): Promise<IExpenseProposalsByCooperativeResult> {
  const { [Queries.Expense.ExpenseProposalsByCooperative.name]: result } = await client.Query(
    Queries.Expense.ExpenseProposalsByCooperative.query,
    { variables: data },
  );
  return result;
}

/** Выданные авансы под отчёт по кооперативу с отбором по состоянию. */
async function loadAdvancesByCooperative(
  data: IGetExpenseAdvancesByCooperativeInput,
): Promise<IExpenseAdvancesByCooperativeResult> {
  const { [Queries.Expense.ExpenseAdvancesByCooperative.name]: result } = await client.Query(
    Queries.Expense.ExpenseAdvancesByCooperative.query,
    { variables: data },
  );
  return result;
}

export const api = { loadProposalsByCooperative, loadAdvancesByCooperative };
