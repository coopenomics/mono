import { verificationReviewSelector } from '../../selectors/verification/verificationReviewSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'verificationReviews'

/**
 * Журнал верификаций личности: кто, где и когда сверял и чем это закончилось.
 * В цепи истории нет — её ведёт кооператив. Читает председатель совета.
 */
export const query = Selector('Query')({
  [name]: [{ data: $('data', 'VerificationReviewsInput') }, verificationReviewSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown
  data?: ModelTypes['VerificationReviewsInput']
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
