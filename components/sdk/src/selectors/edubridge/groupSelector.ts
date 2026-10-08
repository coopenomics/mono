import { Selector, type ValueTypes } from '../../zeus/index'
import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'

const rawGroupSelector = {
  id: true,
  course_id: true,
  title: true,
  status: true,
  enrollment_open: true,
  external_ref: true,
  starts_at: true,
  fee_month: true,
  planned_hourly_rate: true,
  pay_per_learner: true,
  lessons_total: true,
  guarantee_days: true,
  teacher_reserve_balance: true,
  teacher_settled_total: true,
  learners_active: true,
  lessons_held: true,
  created_at: true,
}
const _validateGroup: MakeAllFieldsRequired<ValueTypes['EduGroup']> = rawGroupSelector
export const eduGroupSelector = Selector('EduGroup')(rawGroupSelector)
