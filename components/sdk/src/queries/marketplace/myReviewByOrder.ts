import { marketplaceReviewSelector } from '../../selectors/marketplace/reviewSelector'
import { $, type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'marketplaceMyReviewByOrder'

/** Отзыв заказчика по его заказу; пусто — отзыв ещё не оставлен. */
export const query = Selector('Query')({
  [name]: [{ order_id: $('order_id', 'String!') }, marketplaceReviewSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  order_id: string
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
