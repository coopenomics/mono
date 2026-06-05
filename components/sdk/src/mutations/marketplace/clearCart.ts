import { marketplaceCartSelector } from '../../selectors/marketplace/cartSelector'
import { type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'marketplaceClearCart'

export const mutation = Selector('Mutation')({ [name]: marketplaceCartSelector })

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
