import { eduTeacherContractSelector } from '../../selectors/edubridge/teacherSelector'
import { type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'edubridgeMyContract'

export const query = Selector('Query')({
  [name]: eduTeacherContractSelector,
})

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
