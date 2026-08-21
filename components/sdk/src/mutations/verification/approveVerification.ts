import { verificationReviewSelector } from '../../selectors/verification/verificationReviewSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'approveVerification'

/**
 * Совет подтвердил сверку личности, проведённую на кооперативном участке.
 * На цепи уровень уже есть — решение снимает снимки и закрывает проверку.
 */
export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'ApproveVerificationInput!') }, verificationReviewSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown
  data: ModelTypes['ApproveVerificationInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
