import { verificationReviewPhotoSelector } from '../../selectors/verification/verificationReviewPhotoSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'verificationReviewPhotos'

/**
 * Снимки сверки для проверки советом. Доступны, пока решение не принято:
 * после утверждения или отклонения снимки удаляются.
 */
export const query = Selector('Query')({
  [name]: [{ data: $('data', 'VerificationReviewPhotosInput!') }, verificationReviewPhotoSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown
  data: ModelTypes['VerificationReviewPhotosInput']
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
