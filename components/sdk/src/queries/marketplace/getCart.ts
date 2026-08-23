import { marketplaceCartSelector } from '../../selectors/marketplace/cartSelector'
import { type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'marketplaceGetCart'

export const query = Selector('Query')({ [name]: marketplaceCartSelector })

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
