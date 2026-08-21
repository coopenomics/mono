import { eduLearnerSelector } from '../../selectors/edubridge/memberSelector'
import { type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'edubridgeMyLearners'

export const query = Selector('Query')({
  [name]: eduLearnerSelector,
})

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
