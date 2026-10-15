import { eduReturnBalanceSelector } from '../../selectors/edubridge/returnSelector'
import { type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'edubridgeReturnBalance'

export const query = Selector('Query')({
  [name]: eduReturnBalanceSelector,
})

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
