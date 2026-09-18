import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'
import { Selector, type ValueTypes } from '../../zeus/index'

export const rawCandidateIntakeAnswerSelector = {
  form_id: true,
  title: true,
  json_schema: true,
  values: true,
  submitted_at: true,
}

export const rawCandidateIntakeSelector = {
  username: true,
  program_key: true,
  answers: rawCandidateIntakeAnswerSelector,
}

// Проверка валидности
const _validate: MakeAllFieldsRequired<ValueTypes['CandidateIntake']> = rawCandidateIntakeSelector

export const candidateIntakeSelector = Selector('CandidateIntake')(rawCandidateIntakeSelector)
