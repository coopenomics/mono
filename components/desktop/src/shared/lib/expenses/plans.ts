/**
 * Реестр плановых расходов шасси расходов: добавление записи и показ сроков
 * серии с резервом в месяц. Общий для любого стола, который ведёт плановые
 * расходы (сейчас — «Экономика участка» Стола заказов).
 */
import { Mutations, Queries } from '@coopenomics/sdk';
import { client } from 'src/shared/api/client';

export type ICreateExpensePlanInput = Mutations.Expenses.CreateExpensePlan.IInput['data'];
export type IExpensePlanScheduleInput = Queries.Expenses.ExpensePlanSchedule.IInput['data'];
export type ExpensePlanScheduleView = Queries.Expenses.ExpensePlanSchedule.IOutput['expensePlanSchedule'];

export async function createExpensePlan(data: ICreateExpensePlanInput): Promise<void> {
  await client.Mutation(Mutations.Expenses.CreateExpensePlan.mutation, {
    variables: { data },
  });
}

/** Сроки платежей и резерв в месяц для расхода до добавления — тем же расчётом, что ведёт реестр и итог месяца. */
export async function getExpensePlanSchedule(data: IExpensePlanScheduleInput): Promise<ExpensePlanScheduleView> {
  const { [Queries.Expenses.ExpensePlanSchedule.name]: result } = await client.Query(
    Queries.Expenses.ExpensePlanSchedule.query,
    { variables: { data } },
  );
  return result;
}
