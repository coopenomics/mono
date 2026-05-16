import { marketplaceAplReceptionSelector } from '../../selectors/marketplace/aplReceptionSelector'
import { $, type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'marketplaceListAplReceptionsByBraname'

export const query = Selector('Query')({
  [name]: [{ braname: $('braname', 'String!') }, marketplaceAplReceptionSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  braname: string
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
