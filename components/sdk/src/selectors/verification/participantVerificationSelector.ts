import { Selector } from '../../zeus/index'

/** Подтверждённый уровень верификации пайщика. */
export const participantVerificationSelector = Selector('ParticipantVerification')({
  type: true,
  status: true,
  source: true,
  verified_at: true,
  attested_by: true,
})
