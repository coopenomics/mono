import { eduMemberCardSelector } from '../../selectors/edubridge/adminSelector'
import { $, type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'edubridgeMemberCard'

export const query = Selector('Query')({
  [name]: [{ username: $('username', 'String!') }, eduMemberCardSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  username: string
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
