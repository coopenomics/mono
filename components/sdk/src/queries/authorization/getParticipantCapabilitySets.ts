import { capabilitySetAssignmentSelector } from '../../selectors/authorization/capabilitySetAssignmentSelector'
import { $, type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'getParticipantCapabilitySets'

/**
 * Активные наборы возможностей, назначенные пайщику.
 */
export const query = Selector('Query')({
  [name]: [{ username: $('username', 'String!') }, capabilitySetAssignmentSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  username: string
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
