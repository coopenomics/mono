import { eduConnectorBindingSelector } from '../../selectors/edubridge/adminSelector'
import { type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'edubridgeConnectors'

export const query = Selector('Query')({
  [name]: eduConnectorBindingSelector,
})

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
