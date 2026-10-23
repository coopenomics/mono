import { documentSelector } from '../../selectors/common/documentSelector'
import { $, type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'edubridgeRidStatement'

export const mutation = Selector('Mutation')({
  [name]: [{ contribution_id: $('contribution_id', 'ID!') }, documentSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  contribution_id: string
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
