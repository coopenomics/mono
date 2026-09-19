import type { Mutations, Queries } from '@coopenomics/sdk';

export type IEconomySettings = Queries.Edubridge.EconomySettings.IOutput['edubridgeEconomySettings'];
export type ICourseFee = Queries.Edubridge.CourseFeePreview.IOutput['edubridgeCourseFeePreview'];
export type ICourseEconomy = Queries.Edubridge.CourseEconomy.IOutput['edubridgeCourseEconomy'];
export type ICourseEconomyInput = Queries.Edubridge.CourseFeePreview.IInput['data'];
export type ISetEconomySettingsInput = Mutations.Edubridge.SetEconomySettings.IInput['data'];
export type ISetTeacherRateInput = Mutations.Edubridge.SetTeacherRate.IInput['data'];
