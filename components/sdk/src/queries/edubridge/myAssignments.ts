import { eduAssignmentSelector } from '../../selectors/edubridge/teacherSelector'
import { type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'edubridgeMyAssignments'

export const query = Selector('Query')({
  [name]: eduAssignmentSelector,
})

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
