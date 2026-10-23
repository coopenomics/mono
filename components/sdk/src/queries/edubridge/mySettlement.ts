import { eduTeacherSettlementSelector } from '../../selectors/edubridge/teacherSelector'
import { type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'edubridgeMySettlement'

export const query = Selector('Query')({
  [name]: eduTeacherSettlementSelector,
})

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
