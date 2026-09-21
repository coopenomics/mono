import { eduReturnRequestSelector } from '../../selectors/edubridge/returnSelector'
import { type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'edubridgeMyReturnRequests'

export const query = Selector('Query')({
  [name]: eduReturnRequestSelector,
})

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
