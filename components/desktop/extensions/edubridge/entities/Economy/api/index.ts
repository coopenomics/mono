import { Mutations, Queries } from '@coopenomics/sdk';
import { client } from 'src/shared/api/client';
import type { ICourseEconomyInput, ICreateExpenseInput, ISetEconomySettingsInput, ISetTeacherRateInput } from '../model';

export async function fetchEconomySettings() {
  const { [Queries.Edubridge.EconomySettings.name]: result } = await client.Query(Queries.Edubridge.EconomySettings.query);
  return result;
}

/** Расходы программы — ведёт общее шасси расходов. */
export async function fetchExpenses(options?: Queries.Edubridge.Expenses.IInput['options']) {
  const { [Queries.Edubridge.Expenses.name]: result } = await client.Query(Queries.Edubridge.Expenses.query, {
    variables: { options },
  });
  return result;
}

export async function createExpense(data: ICreateExpenseInput) {
  const { [Mutations.Edubridge.CreateExpense.name]: result } = await client.Mutation(Mutations.Edubridge.CreateExpense.mutation, {
    variables: { data },
  });
  return result;
}

/** Деньги программы: кошельки и лента движения. */
export async function fetchProgramFund() {
  const { [Queries.Edubridge.ProgramFund.name]: result } = await client.Query(Queries.Edubridge.ProgramFund.query);
  return result;
}

export async function setEconomySettings(data: ISetEconomySettingsInput) {
  const { [Mutations.Edubridge.SetEconomySettings.name]: result } = await client.Mutation(
    Mutations.Edubridge.SetEconomySettings.mutation,
    { variables: { data } },
  );
  return result;
}

export async function setTeacherRate(data: ISetTeacherRateInput) {
  const { [Mutations.Edubridge.SetTeacherRate.name]: result } = await client.Mutation(Mutations.Edubridge.SetTeacherRate.mutation, {
    variables: { data },
  });
  return result;
}

/** Расчёт взноса по параметрам формы — до сохранения курса. */
export async function fetchCourseFeePreview(data: ICourseEconomyInput) {
  const { [Queries.Edubridge.CourseFeePreview.name]: result } = await client.Query(Queries.Edubridge.CourseFeePreview.query, {
    variables: { data },
  });
  return result;
}

export async function fetchCourseEconomy(course_id: string) {
  const { [Queries.Edubridge.CourseEconomy.name]: result } = await client.Query(Queries.Edubridge.CourseEconomy.query, {
    variables: { course_id },
  });
  return result;
}
