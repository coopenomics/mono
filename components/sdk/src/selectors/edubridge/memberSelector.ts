import { Selector, type ValueTypes } from '../../zeus/index'
import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'

const rawLearnerSelector = {
  id: true,
  display_name: true,
  recipient_type: true,
  recipient_value: true,
  is_self: true,
  created_at: true,
}
const _validateLearner: MakeAllFieldsRequired<ValueTypes['EduLearner']> = rawLearnerSelector
export const eduLearnerSelector = Selector('EduLearner')(rawLearnerSelector)

const rawEnrollmentSelector = {
  id: true,
  learner_id: true,
  course_id: true,
  course_title: true,
  period: true,
  paid_until: true,
  status: true,
  access_state: true,
  sub_hash: true,
}
const _validateEnrollment: MakeAllFieldsRequired<ValueTypes['EduEnrollment']> = rawEnrollmentSelector
export const eduEnrollmentSelector = Selector('EduEnrollment')(rawEnrollmentSelector)

const rawQuoteSelector = {
  amount: true,
  available: true,
  enough: true,
  shortfall: true,
  is_extension: true,
  paid_until: true,
  sub_hash: true,
}
const _validateQuote: MakeAllFieldsRequired<ValueTypes['EduQuote']> = rawQuoteSelector
export const eduQuoteSelector = Selector('EduQuote')(rawQuoteSelector)

