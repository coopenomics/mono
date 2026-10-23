import type { Mutations, Queries } from '@coopenomics/sdk';

export type IEconomySettings = Queries.Edubridge.EconomySettings.IOutput['edubridgeEconomySettings'];
export type IProgramFund = Queries.Edubridge.ProgramFund.IOutput['edubridgeProgramFund'];
export type IFundMovement = IProgramFund['movements'][number];
export type ICourseFee = Queries.Edubridge.CourseFeePreview.IOutput['edubridgeCourseFeePreview'];
export type ICourseEconomy = Queries.Edubridge.CourseEconomy.IOutput['edubridgeCourseEconomy'];
export type ICourseEconomyInput = Queries.Edubridge.CourseFeePreview.IInput['data'];
export type ISetEconomySettingsInput = Mutations.Edubridge.SetEconomySettings.IInput['data'];
export type ISetTeacherRateInput = Mutations.Edubridge.SetTeacherRate.IInput['data'];
export type IExpense = Queries.Edubridge.Expenses.IOutput['edubridgeExpenses']['items'][number];
export type ICreateExpenseInput = Mutations.Edubridge.CreateExpense.IInput['data'];

/** Кошелёк-источник расходов программы — пул шасси расходов. */
export const EDU_EXPENSE_WALLET = 'w.edu.expns';
