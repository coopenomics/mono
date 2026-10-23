import { eduEnrollmentSelector } from '../../selectors/edubridge/memberSelector'
import { type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'edubridgeMyEnrollments'

export const query = Selector('Query')({
  [name]: eduEnrollmentSelector,
})

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
