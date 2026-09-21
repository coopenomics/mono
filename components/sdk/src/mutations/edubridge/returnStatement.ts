import { documentSelector } from '../../selectors/common/documentSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'edubridgeReturnStatement'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'EduReturnStatementInput!') }, documentSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['EduReturnStatementInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
