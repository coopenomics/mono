import { Selector, type ValueTypes } from '../../zeus/index'
import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'

const rawEconomySettingsSelector = {
  markup_percent: true,
  max_course_discount_percent: true,
}
const _validateSettings: MakeAllFieldsRequired<ValueTypes['EduEconomySettings']> = rawEconomySettingsSelector
export const eduEconomySettingsSelector = Selector('EduEconomySettings')(rawEconomySettingsSelector)

const rawCourseFeeSelector = {
  hours_per_month: true,
  cost_month: true,
  markup_month: true,
  fee_month: true,
  course_months: true,
  fee_course_base: true,
  course_discount_amount: true,
  fee_course: true,
  cost_course: true,
  max_course_discount_percent: true,
  markup_percent: true,
}
const _validateFee: MakeAllFieldsRequired<ValueTypes['EduCourseFee']> = rawCourseFeeSelector
export const eduCourseFeeSelector = Selector('EduCourseFee')(rawCourseFeeSelector)

const rawTeacherLoadSelector = {
  username: true,
  display_name: true,
  hourly_rate: true,
  hours_per_month: true,
  cost_month: true,
}
const _validateLoad: MakeAllFieldsRequired<ValueTypes['EduCourseTeacherLoad']> = rawTeacherLoadSelector

const rawCourseEconomySelector = {
  plan: rawCourseFeeSelector,
  teachers: rawTeacherLoadSelector,
  actual_cost_month: true,
  actual_hours_per_month: true,
  over_fee: true,
}
const _validateEconomy: MakeAllFieldsRequired<ValueTypes['EduCourseEconomy']> = rawCourseEconomySelector
export const eduCourseEconomySelector = Selector('EduCourseEconomy')(rawCourseEconomySelector)

const rawProgramWalletSelector = {
  id: true,
  name: true,
  available: true,
  summary: true,
  hint: true,
}
const _validateWallet: MakeAllFieldsRequired<ValueTypes['EduProgramWallet']> = rawProgramWalletSelector

const rawFundMovementSelector = {
  id: true,
  at: true,
  title: true,
  amount: true,
  username: true,
  display_name: true,
  direction: true,
}
const _validateMovement: MakeAllFieldsRequired<ValueTypes['EduFundMovement']> = rawFundMovementSelector

const rawProgramFundSelector = {
  wallets: rawProgramWalletSelector,
  fund_balance: true,
  members_balance: true,
  movements: rawFundMovementSelector,
}
const _validateFund: MakeAllFieldsRequired<ValueTypes['EduProgramFund']> = rawProgramFundSelector
export const eduProgramFundSelector = Selector('EduProgramFund')(rawProgramFundSelector)
