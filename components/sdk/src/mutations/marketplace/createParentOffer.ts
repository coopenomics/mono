import { rawTransactionSelector } from '../../selectors'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'createParentOffer'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'CreateParentOfferInput!') }, rawTransactionSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['CreateParentOfferInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
