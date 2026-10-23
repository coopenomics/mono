import { eduAssignmentSelector } from '../../selectors/edubridge/teacherSelector'
import { $, type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'edubridgeCloseAssignment'

export const mutation = Selector('Mutation')({
  [name]: [{ id: $('id', 'ID!') }, eduAssignmentSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  id: string
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
