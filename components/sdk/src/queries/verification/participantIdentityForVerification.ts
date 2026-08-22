import { participantIdentityForVerificationSelector } from '../../selectors/verification/participantIdentityForVerificationSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'participantIdentityForVerification'

/**
 * Данные пайщика для сверки с документом. Сервер отдаёт их, пока личность не
 * подтверждена: как только верификация проведена, повод отпадает и запрос
 * отказывает.
 */
export const query = Selector('Query')({
  [name]: [
    { data: $('data', 'ParticipantIdentityForVerificationInput!') },
    participantIdentityForVerificationSelector,
  ],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown
  data: ModelTypes['ParticipantIdentityForVerificationInput']
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
