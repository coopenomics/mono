import { eduProgramFundSelector } from '../../selectors/edubridge/economySelector'
import { type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'edubridgeProgramFund'

export const query = Selector('Query')({
  [name]: eduProgramFundSelector,
})

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
