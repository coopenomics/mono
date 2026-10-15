import { eduLessonSelector } from '../../selectors/edubridge/teacherSelector'
import { type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'edubridgeMyLessons'

export const query = Selector('Query')({
  [name]: eduLessonSelector,
})

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
