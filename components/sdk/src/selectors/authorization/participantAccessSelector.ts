import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'
import { Selector, type ValueTypes } from '../../zeus/index'
import { rawAccessGrantSelector } from './accessGrantSelector'

export const rawParticipantAccessSelector = {
  sets: true,
  grants: rawAccessGrantSelector,
}

// Проверка валидности
const _validate: MakeAllFieldsRequired<ValueTypes['ParticipantAccess']> = rawParticipantAccessSelector

export const participantAccessSelector = Selector('ParticipantAccess')(rawParticipantAccessSelector)
