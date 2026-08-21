import { eduMemberRowSelector } from '../../selectors/edubridge/adminSelector'
import { $, type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'edubridgeMembers'

export const query = Selector('Query')({
  [name]: [{ search: $('search', 'String') }, eduMemberRowSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  search?: string
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
