import { documentSelector } from '../../selectors/common/documentSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'edubridgeShareWithdrawStatement'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'EduShareWithdrawStatementInput!') }, documentSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['EduShareWithdrawStatementInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
