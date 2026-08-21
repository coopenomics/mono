import { participantVerificationSelector } from '../../selectors/verification/participantVerificationSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'unverifyParticipant'

/**
 * Отозвать верификацию личности пайщика (председатель кооператива).
 * Возвращает актуальные уровни верификации пайщика.
 */
export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'UnverifyParticipantInput!') }, participantVerificationSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown
  data: ModelTypes['UnverifyParticipantInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
