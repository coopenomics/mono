import { Selector } from '../../zeus/index'

/** Данные пайщика для сверки с документом при подтверждении личности. */
export const participantIdentityForVerificationSelector = Selector('ParticipantIdentityForVerification')({
  username: true,
  type: true,
  full_name: true,
  birthdate: true,
  passport_series: true,
  passport_number: true,
  passport_issued_by: true,
  passport_issued_at: true,
  passport_code: true,
  full_address: true,
  inn: true,
  ogrn: true,
  representative_name: true,
  representative_position: true,
  representative_based_on: true,
})
