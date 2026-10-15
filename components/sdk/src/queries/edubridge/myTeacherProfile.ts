import { eduTeacherProfileSelector } from '../../selectors/edubridge/teacherSelector'
import { type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'edubridgeMyTeacherProfile'

export const query = Selector('Query')({
  [name]: eduTeacherProfileSelector,
})

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
