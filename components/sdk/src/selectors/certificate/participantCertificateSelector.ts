import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'
import { Selector, type ValueTypes } from '../../zeus/index'

export const rawParticipantCertificateSelector = {
  participant_certificate: true,
}

// Проверка валидности
const _validate: MakeAllFieldsRequired<ValueTypes['ParticipantCertificate']> = rawParticipantCertificateSelector

export const participantCertificateSelector = Selector('ParticipantCertificate')(rawParticipantCertificateSelector)
