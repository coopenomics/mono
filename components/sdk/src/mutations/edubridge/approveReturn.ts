import { eduReturnRequestSelector } from '../../selectors/edubridge/returnSelector'
import { $, type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'edubridgeApproveReturn'

export const mutation = Selector('Mutation')({
  [name]: [{ id: $('id', 'ID!') }, eduReturnRequestSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  id: string
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
