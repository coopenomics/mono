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
  paid_amount: true,
  refunded_amount: true,
  refund_reason: true,
  cancelled_at: true,
}
const _validateEnrollment: MakeAllFieldsRequired<ValueTypes['EduEnrollment']> = rawEnrollmentSelector
export const eduEnrollmentSelector = Selector('EduEnrollment')(rawEnrollmentSelector)

const rawQuoteSelector = {
  amount: true,
  months: true,
  base_amount: true,
  discount_amount: true,
  available: true,
  enough: true,
  shortfall: true,
  is_extension: true,
  paid_until: true,
  sub_hash: true,
}
const _validateQuote: MakeAllFieldsRequired<ValueTypes['EduQuote']> = rawQuoteSelector
export const eduQuoteSelector = Selector('EduQuote')(rawQuoteSelector)

const rawRefundPreviewSelector = {
  reason: true,
  refund: true,
  withheld: true,
  lessons_paid: true,
  lessons_used: true,
  to_share: true,
}
const _validateRefundPreview: MakeAllFieldsRequired<ValueTypes['EduRefundPreview']> = rawRefundPreviewSelector
export const eduRefundPreviewSelector = Selector('EduRefundPreview')(rawRefundPreviewSelector)
