import { client } from 'src/shared/api/client';
import { Queries } from '@coopenomics/sdk';
import type {
  IExpenseAdvancesByMemberResult,
  IExpenseProposalsByCooperativeResult,
  IGetExpenseAdvancesByMemberInput,
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

/** Служебные записки, по строкам которых пайщик получает аванс под отчёт. */
async function loadAdvancesByMember(
  data: IGetExpenseAdvancesByMemberInput,
): Promise<IExpenseAdvancesByMemberResult> {
  const { [Queries.Expense.ExpenseAdvancesByMember.name]: result } = await client.Query(
    Queries.Expense.ExpenseAdvancesByMember.query,
    { variables: data },
  );
  return result;
}

export const api = { loadProposalsByCooperative, loadAdvancesByMember };
