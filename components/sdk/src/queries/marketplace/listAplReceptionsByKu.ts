import { marketplaceAplReceptionSelector } from '../../selectors/marketplace/aplReceptionSelector'
import { $, type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'marketplaceListAplReceptionsByKu'

export const query = Selector('Query')({
  [name]: [{ ku_id: $('ku_id', 'String!') }, marketplaceAplReceptionSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  ku_id: string
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
