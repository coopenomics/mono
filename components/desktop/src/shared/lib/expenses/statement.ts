/**
 * Служебная записка шасси расходов: номер пункта, срок в документе и сборка
 * документа на сервере. Одна реализация на форму записки (`ExpenseCreateDialog`)
 * и подпись готовой записки по плановому расходу.
 */
import { Mutations } from '@coopenomics/sdk';
import { client } from 'src/shared/api/client';
import { t } from 'src/shared/i18n';

export type IGenerateExpenseStatementInput = Mutations.Expense.GenerateExpenseProposalStatementDocument.IInput['data'];
export type GeneratedExpenseStatement =
  Mutations.Expense.GenerateExpenseProposalStatementDocument.IOutput['generateExpenseProposalStatementDocument'];

/** Хэш пункта записки: хэш записки и номер пункта — пункты одной записки различимы и воспроизводимы. */
export function generateExpenseItemHash(expenseHash: string, idx: number): string {
  return `${expenseHash.slice(0, 56)}${idx.toString(16).padStart(8, '0')}`;
}

/**
 * Срок исполнения для документа: `ГГГГ-ММ-ДД` → `ДД.ММ.ГГГГ`. Срок обязателен:
 * он попадает в текст служебной записки, и без него совет рассматривал бы
 * расход без указания, к какому сроку платить.
 */
export function formatStatementDeadline(value: string): string {
  const [year, month, day] = value.split('-');
  if (!year || !month || !day) {
    throw new Error(t('ui.error.expenseDueDateRequired'));
  }
  return `${day}.${month.padStart(2, '0')}.${year}`;
}

/** Документ служебной записки: полные реквизиты получателей подставляет сервер. */
export async function generateExpenseStatement(data: IGenerateExpenseStatementInput): Promise<GeneratedExpenseStatement> {
  const { [Mutations.Expense.GenerateExpenseProposalStatementDocument.name]: generated } = await client.Mutation(
    Mutations.Expense.GenerateExpenseProposalStatementDocument.mutation,
    { variables: { data, options: { lang: 'ru' } } },
  );
  return generated;
}
