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
  starts_at_time: true,
  fee_month: true,
  planned_hourly_rate: true,
  pay_per_learner: true,
  lessons_total: true,
  guarantee_days: true,
  schedule_slots: { weekday: true, time: true, minutes: true, assignment_id: true },
  schedule: true,
  report_days: true,
  lessons_per_month: true,
  lesson_minutes: true,
  program_months: true,
  minutes_per_month: true,
  minutes_total: true,
  teacher_reserve_balance: true,
  teacher_settled_total: true,
  learners_active: true,
  lessons_held: true,
  settlement_pending: true,
  created_at: true,
}
const _validateGroup: MakeAllFieldsRequired<ValueTypes['EduGroup']> = rawGroupSelector
export const eduGroupSelector = Selector('EduGroup')(rawGroupSelector)
