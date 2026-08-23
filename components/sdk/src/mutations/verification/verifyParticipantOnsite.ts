import { participantVerificationSelector } from '../../selectors/verification/participantVerificationSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'verifyParticipantOnsite'

/**
 * Подтвердить личность пайщика по паспорту на кооперативном участке.
 * Вызывает председатель участка или его доверенное лицо; полномочия
 * проверяет контракт. Возвращает актуальные уровни верификации пайщика.
 */
export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'VerifyParticipantOnsiteInput!') }, participantVerificationSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown
  data: ModelTypes['VerifyParticipantOnsiteInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
