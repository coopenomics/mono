import { Selector, type ValueTypes } from '../../zeus/index'
import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'

const rawContractSelector = { contract_hash: true, contract_number: true, status: true, decline_reason: true, hourly_rate: true, signed_at: true, approved_at: true }
const _validateContract: MakeAllFieldsRequired<ValueTypes['EduTeacherContract']> = rawContractSelector
export const eduTeacherContractSelector = Selector('EduTeacherContract')(rawContractSelector)

const rawAssignmentSelector = {
  id: true,
  teacher_username: true,
  course_id: true,
  course_title: true,
  schedule: true,
  expected_result: true,
  period_from: true,
  period_to: true,
  annex_hash: true,
  minutes_per_month: true,
  status: true,
  decline_reason: true,
  created_at: true,
}
const _validateAssignment: MakeAllFieldsRequired<ValueTypes['EduAssignment']> = rawAssignmentSelector
export const eduAssignmentSelector = Selector('EduAssignment')(rawAssignmentSelector)

const rawContributionSelector = {
  hold_until: true,
  storage_act_hash: true,
  id: true,
  teacher_username: true,
  assignment_id: true,
  rid_hash: true,
  rid_type: true,
  links: true,
  description: true,
  amount: true,
  status: true,
  statement_hash: true,
  decision_hash: true,
  act_hash: true,
  decline_reason: true,
  council_decision_id: true,
  council_outcome: true,
  decided_at: true,
  created_at: true,
}
const _validateContribution: MakeAllFieldsRequired<ValueTypes['EduContribution']> = rawContributionSelector
export const eduContributionSelector = Selector('EduContribution')(rawContributionSelector)

const rawSettlementSelector = { accepted_total: true, available: true, last_accepted_at: true }
const _validateSettlement: MakeAllFieldsRequired<ValueTypes['EduTeacherSettlement']> = rawSettlementSelector
export const eduTeacherSettlementSelector = Selector('EduTeacherSettlement')(rawSettlementSelector)

const rawLessonSelector = {
  id: true,
  course_id: true,
  course_title: true,
  lesson_number: true,
  topic: true,
  held_at: true,
  duration_minutes: true,
  materials: true,
  contribution_id: true,
}
const _validateLesson: MakeAllFieldsRequired<ValueTypes['EduLesson']> = rawLessonSelector
export const eduLessonSelector = Selector('EduLesson')(rawLessonSelector)
