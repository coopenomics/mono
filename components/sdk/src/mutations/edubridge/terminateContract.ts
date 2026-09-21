import { eduTeacherContractSelector } from '../../selectors/edubridge/teacherSelector'
import { $, type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'edubridgeTerminateContract'

export const mutation = Selector('Mutation')({
  [name]: [{ username: $('username', 'String!'), reason: $('reason', 'String!') }, eduTeacherContractSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  username: string
  reason: string
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
