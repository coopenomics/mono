import { eduContributionSelector } from '../../selectors/edubridge/teacherSelector'
import { type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'edubridgeContributions'

export const query = Selector('Query')({
  [name]: eduContributionSelector,
})

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
