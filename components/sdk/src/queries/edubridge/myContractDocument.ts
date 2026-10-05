import { documentAggregateSelector } from '../../selectors/documents'
import { type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'edubridgeMyContractDocument'

/** Мой подписанный договор участия в хозяйственной деятельности */
export const query = Selector('Query')({
  [name]: documentAggregateSelector,
})

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
