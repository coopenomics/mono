import { verificationReviewSelector } from '../../selectors/verification/verificationReviewSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'rejectVerification'

/**
 * Совет отклонил сверку личности: верификация отзывается с цепи, и пайщик
 * снова не получит имущество, пока не подтвердит личность заново.
 */
export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'RejectVerificationInput!') }, verificationReviewSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown
  data: ModelTypes['RejectVerificationInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
