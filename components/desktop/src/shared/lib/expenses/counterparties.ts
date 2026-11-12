/**
 * Реестр контрагентов шасси расходов (задача 99D-35): организации и ИП, которым
 * кооператив платит по реквизитам. Один набор вызовов на стол совета (реестр),
 * выбор получателя в плановом расходе участка и записку шасси.
 */
import { Mutations, Queries } from '@coopenomics/sdk';
import { client } from 'src/shared/api/client';

export type ExpenseCounterpartyView = Queries.Expenses.ExpenseCounterparties.IOutput['expenseCounterparties'][number];
export type ExpenseCounterpartyFormView = Queries.Expenses.ExpenseCounterpartyForm.IOutput['expenseCounterpartyForm'];
export type IListExpenseCounterpartiesInput = NonNullable<Queries.Expenses.ExpenseCounterparties.IInput['data']>;
export type ISaveExpenseCounterpartyInput = Mutations.Expenses.CreateExpenseCounterparty.IInput['data'];
export type IUpdateExpenseCounterpartyInput = Mutations.Expenses.UpdateExpenseCounterparty.IInput['data'];
export type IArchiveExpenseCounterpartyInput = Mutations.Expenses.ArchiveExpenseCounterparty.IInput['data'];
export type IDeleteExpenseCounterpartyInput = Mutations.Expenses.DeleteExpenseCounterparty.IInput['data'];
export type ICheckExpenseCounterpartyInput = Queries.Expenses.CheckExpenseCounterpartyRequisites.IInput['data'];
export type ExpenseCounterpartyRequisiteIssue =
  Queries.Expenses.CheckExpenseCounterpartyRequisites.IOutput['checkExpenseCounterpartyRequisites'][number];

/** Проверка реквизитов до сохранения — те же правила страны, что при сохранении. */
export async function checkExpenseCounterpartyRequisites(
  data: ICheckExpenseCounterpartyInput,
): Promise<ExpenseCounterpartyRequisiteIssue[]> {
  const { [Queries.Expenses.CheckExpenseCounterpartyRequisites.name]: result } = await client.Query(
    Queries.Expenses.CheckExpenseCounterpartyRequisites.query,
    { variables: { data } },
  );
  return result;
}

export async function listExpenseCounterparties(data: IListExpenseCounterpartiesInput): Promise<ExpenseCounterpartyView[]> {
  const { [Queries.Expenses.ExpenseCounterparties.name]: result } = await client.Query(
    Queries.Expenses.ExpenseCounterparties.query,
    { variables: { data } },
  );
  return result;
}

export async function getExpenseCounterpartyForm(): Promise<ExpenseCounterpartyFormView> {
  const { [Queries.Expenses.ExpenseCounterpartyForm.name]: result } = await client.Query(
    Queries.Expenses.ExpenseCounterpartyForm.query,
  );
  return result;
}

export async function createExpenseCounterparty(data: ISaveExpenseCounterpartyInput): Promise<ExpenseCounterpartyView> {
  const { [Mutations.Expenses.CreateExpenseCounterparty.name]: result } = await client.Mutation(
    Mutations.Expenses.CreateExpenseCounterparty.mutation,
    { variables: { data } },
  );
  return result;
}

export async function updateExpenseCounterparty(data: IUpdateExpenseCounterpartyInput): Promise<ExpenseCounterpartyView> {
  const { [Mutations.Expenses.UpdateExpenseCounterparty.name]: result } = await client.Mutation(
    Mutations.Expenses.UpdateExpenseCounterparty.mutation,
    { variables: { data } },
  );
  return result;
}

export async function archiveExpenseCounterparty(data: IArchiveExpenseCounterpartyInput): Promise<ExpenseCounterpartyView> {
  const { [Mutations.Expenses.ArchiveExpenseCounterparty.name]: result } = await client.Mutation(
    Mutations.Expenses.ArchiveExpenseCounterparty.mutation,
    { variables: { data } },
  );
  return result;
}

export async function deleteExpenseCounterparty(data: IDeleteExpenseCounterpartyInput): Promise<boolean> {
  const { [Mutations.Expenses.DeleteExpenseCounterparty.name]: result } = await client.Mutation(
    Mutations.Expenses.DeleteExpenseCounterparty.mutation,
    { variables: { data } },
  );
  return result;
}
