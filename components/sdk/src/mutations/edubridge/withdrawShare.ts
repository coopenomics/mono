import { eduTeacherSettlementSelector } from '../../selectors/edubridge/teacherSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'edubridgeWithdrawShare'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'EduWithdrawShareInput!') }, eduTeacherSettlementSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['EduWithdrawShareInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
