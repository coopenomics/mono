import { Selector, type ValueTypes } from '../../zeus/index'
import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'

const rawMemberRowSelector = { username: true, display_name: true, learners_count: true, active_enrollments: true, attention_count: true }
const _validateMemberRow: MakeAllFieldsRequired<ValueTypes['EduMemberRow']> = rawMemberRowSelector
export const eduMemberRowSelector = Selector('EduMemberRow')(rawMemberRowSelector)

const rawTaskSelector = {
  id: true,
  enrollment_id: true,
  kind: true,
  carrier: true,
  status: true,
  attempts: true,
  next_attempt_at: true,
  last_error: true,
  last_result: true,
  done_at: true,
  created_at: true,
  updated_at: true,
}
const _validateTask: MakeAllFieldsRequired<ValueTypes['EduAccessTask']> = rawTaskSelector
export const eduAccessTaskSelector = Selector('EduAccessTask')(rawTaskSelector)

const rawLearnerSelector = { id: true, display_name: true, recipient_type: true, recipient_value: true, is_self: true, created_at: true }
const rawEnrollmentSelector = { id: true, learner_id: true, course_id: true, course_title: true, period: true, paid_until: true, status: true, access_state: true, sub_hash: true }
const rawMemberCardSelector = { username: true, display_name: true, learners: rawLearnerSelector, enrollments: rawEnrollmentSelector, tasks: rawTaskSelector }
const _validateMemberCard: MakeAllFieldsRequired<ValueTypes['EduMemberCard']> = rawMemberCardSelector
export const eduMemberCardSelector = Selector('EduMemberCard')(rawMemberCardSelector)

const rawBindingSelector = { carrier: true, enabled: true, configured: true, health: true, last_check_at: true, last_check_message: true }
const _validateBinding: MakeAllFieldsRequired<ValueTypes['EduConnectorBinding']> = rawBindingSelector
export const eduConnectorBindingSelector = Selector('EduConnectorBinding')(rawBindingSelector)

const rawAdminSelector = { id: true, username: true, display_name: true, appointed_by: true, appointed_by_display_name: true, created_at: true }
const _validateAdmin: MakeAllFieldsRequired<ValueTypes['EduAdmin']> = rawAdminSelector
export const eduAdminSelector = Selector('EduAdmin')(rawAdminSelector)
