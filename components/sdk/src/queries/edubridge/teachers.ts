import { eduTeacherSelector } from '../../selectors/edubridge/courseSelector'
import { type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'edubridgeTeachers'

export const query = Selector('Query')({
  [name]: eduTeacherSelector,
})

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
