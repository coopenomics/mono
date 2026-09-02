import { eduTeacherOptionSelector } from '../../selectors/edubridge/courseSelector'
import { type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'edubridgeTeacherOptions'

export const query = Selector('Query')({
  [name]: eduTeacherOptionSelector,
})

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
