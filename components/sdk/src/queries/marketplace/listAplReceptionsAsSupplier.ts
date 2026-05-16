import { marketplaceAplReceptionSelector } from '../../selectors/marketplace/aplReceptionSelector'
import { type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'marketplaceListAplReceptionsAsSupplier'

export const query = Selector('Query')({
  [name]: marketplaceAplReceptionSelector,
})

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
