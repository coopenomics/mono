import type { Queries } from '@coopenomics/sdk'

export * from './store'
export type { IGenerateRegistrationDocumentsInput, IGenerateRegistrationDocumentsOutput, IGeneratedRegistrationDocument, IRegistrationDocument } from './store'


/** Сведения заявителя о себе: программа вступления и ответы на анкеты. */
export type ICandidateIntake =
  Queries.Registration.GetCandidateIntake.IOutput[typeof Queries.Registration.GetCandidateIntake.name]
export type ICandidateIntakeAnswer = ICandidateIntake['answers'][number]

/**
 * Человеческие названия программ вступления. Ключи задаёт платформа
 * (`ProgramKey`), формулировки — по семантике программ кооператива.
 */
const PROGRAM_TITLES: Record<string, string> = {
  GENERATION: 'Генератор',
  CAPITALIZATION: 'Благорост',
  MARKETPLACE: 'Стол заказов',
}

export const registrationProgramTitle = (programKey?: string | null): string =>
  programKey ? PROGRAM_TITLES[programKey] ?? '' : ''
