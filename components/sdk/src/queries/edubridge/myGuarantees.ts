import { eduGuaranteeStateSelector } from '../../selectors/edubridge/guaranteeSelector'
import { type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'edubridgeMyGuarantees'

/** Гарантийные условия по моим подпискам и поданные заявления */
export const query = Selector('Query')({
  [name]: eduGuaranteeStateSelector,
})

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
