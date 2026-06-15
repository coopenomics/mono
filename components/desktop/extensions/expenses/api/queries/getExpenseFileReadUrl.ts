import { client } from 'src/shared/api/client';
import { Queries } from '@coopenomics/sdk';

// Списочные запросы файлов отдают короткоживущий read_url — свежую ссылку на
// файл (чек/подтверждение) запрашиваем по id в момент клика. Тот же приём, что
// на странице расхода программы (capital ProgramExpense.api).
export async function getExpenseFileReadUrl(id: number): Promise<string | undefined> {
  const { [Queries.Expense.ExpenseFile.name]: result } = await client.Query(
    Queries.Expense.ExpenseFile.query,
    { variables: { id } },
  );
  return result.read_url ?? undefined;
}
