import { client } from 'src/shared/api/client';
import { Mutations, Queries } from '@coopenomics/sdk';
import type {
  IProgramExpense,
  IProgramExpensesPagination,
  IGetProgramExpenseInput,
  IGetProgramExpensesInput,
  IExpenseProposalAggregate,
  IExpenseProposalFile,
  IExpenseRequisite,
} from '../model/types';

async function loadProgramExpenses(
  data: IGetProgramExpensesInput,
): Promise<IProgramExpensesPagination> {
  const { [Queries.Capital.GetProgramExpenses.name]: output } = await client.Query(
    Queries.Capital.GetProgramExpenses.query,
    { variables: data },
  );
  return output;
}

async function loadProgramExpense(
  data: IGetProgramExpenseInput,
): Promise<IProgramExpense> {
  const { [Queries.Capital.GetProgramExpense.name]: output } = await client.Query(
    Queries.Capital.GetProgramExpense.query,
    { variables: data },
  );
  return output;
}

// Документы СЗ (заявление + решение совета) — из шасси expense: capital-проекция
// отдаёт только зеркальные данные таблицы, агрегаты документов живут в proposal.
async function loadExpenseProposal(
  proposalHash: string,
): Promise<IExpenseProposalAggregate | null> {
  const { [Queries.Expense.ExpenseProposal.name]: output } = await client.Query(
    Queries.Expense.ExpenseProposal.query,
    { variables: { proposal_hash: proposalHash } },
  );
  return output ?? null;
}

async function loadExpenseFiles(
  coopname: string,
  proposalHash: string,
): Promise<IExpenseProposalFile[]> {
  const { [Queries.Expense.ExpenseFilesByProposal.name]: output } = await client.Query(
    Queries.Expense.ExpenseFilesByProposal.query,
    { variables: { coopname, proposal_hash: proposalHash } },
  );
  return output;
}

async function loadExpenseRequisites(
  coopname: string,
  proposalHash: string,
): Promise<IExpenseRequisite[]> {
  const { [Queries.Expense.ExpenseRequisitesByProposal.name]: output } = await client.Query(
    Queries.Expense.ExpenseRequisitesByProposal.query,
    { variables: { coopname, proposal_hash: proposalHash } },
  );
  return output;
}

// Закрытие расхода (финализация СЗ-отчёта советом) — все позиции оплачены и
// отчитаны, председатель/член совета закрывает расход целиком.
async function closeExpenseProposal(
  coopname: string,
  proposalHash: string,
): Promise<void> {
  await client.Mutation(Mutations.Expense.SubmitExpenseReport.mutation, {
    variables: { data: { coopname, proposal_hash: proposalHash } },
  });
}

// Списочные запросы файлов отдают записи без read_url (он короткоживущий) —
// свежая ссылка запрашивается по id в момент клика.
async function getExpenseFileReadUrl(id: number): Promise<string | undefined> {
  const { [Queries.Expense.ExpenseFile.name]: result } = await client.Query(
    Queries.Expense.ExpenseFile.query,
    { variables: { id } },
  );
  return result.read_url ?? undefined;
}

export const api = {
  loadProgramExpenses,
  loadProgramExpense,
  loadExpenseProposal,
  loadExpenseFiles,
  loadExpenseRequisites,
  closeExpenseProposal,
  getExpenseFileReadUrl,
};
