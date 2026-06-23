import { client } from 'src/shared/api/client';
import { Mutations, Queries, Zeus } from '@coopenomics/sdk';

export type IUploadExpenseFileInput = Mutations.Expense.UploadExpenseFile.IInput['data'];
export type IExpenseFile =
  Queries.Expense.ExpenseFilesByItem.IOutput[typeof Queries.Expense.ExpenseFilesByItem.name][number];

async function uploadExpenseFile(data: IUploadExpenseFileInput): Promise<IExpenseFile> {
  const { [Mutations.Expense.UploadExpenseFile.name]: result } = await client.Mutation(
    Mutations.Expense.UploadExpenseFile.mutation,
    { variables: { data } },
  );
  return result;
}

async function loadExpenseFilesByItem(
  coopname: string,
  proposal_hash: string,
  item_hash: string,
): Promise<IExpenseFile[]> {
  const { [Queries.Expense.ExpenseFilesByItem.name]: result } = await client.Query(
    Queries.Expense.ExpenseFilesByItem.query,
    { variables: { coopname, proposal_hash, item_hash } },
  );
  return result;
}

// Механика строки расхода (ADVANCE/DIRECT) нужна, чтобы решить, показывать ли
// закрывающие документы: чек об оплате теперь общий (в ядре), а по оплате
// организации (DIRECT) — ещё и закрывающие документы (акт/счёт-фактура/накладная).
async function loadItemMechanics(
  proposal_hash: string,
  item_hash: string,
): Promise<Zeus.ExpenseMechanics | null> {
  const { [Queries.Expense.ExpenseProposal.name]: proposal } = await client.Query(
    Queries.Expense.ExpenseProposal.query,
    { variables: { proposal_hash } },
  );
  const item = proposal?.items?.find(
    (i) => i.item_hash?.toLowerCase() === item_hash.toLowerCase(),
  );
  return item?.mechanics ?? null;
}

// Списочные запросы файлы отдают без read_url — свежий короткоживущий URL
// запрашивается по id в момент клика.
async function getExpenseFileReadUrl(id: number): Promise<string | undefined> {
  const { [Queries.Expense.ExpenseFile.name]: result } = await client.Query(
    Queries.Expense.ExpenseFile.query,
    { variables: { id } },
  );
  return result.read_url ?? undefined;
}

export const api = {
  uploadExpenseFile,
  loadExpenseFilesByItem,
  loadItemMechanics,
  getExpenseFileReadUrl,
};
