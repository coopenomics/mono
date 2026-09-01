import { Selector } from '../../zeus/index'

/** Запись журнала верификаций: одна сверка личности и её судьба. */
export const verificationReviewSelector = Selector('VerificationReview')({
  id: true,
  username: true,
  procedure: true,
  braname: true,
  verificator: true,
  status: true,
  photos_count: true,
  created_at: true,
  decided_by: true,
  decided_at: true,
  decision_reason: true,
})
