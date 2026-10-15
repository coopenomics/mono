import type { GraphQLTypes, InputType } from '../../zeus/index'
import { rawAssignableRoleSelector } from '../../selectors/accessRoles/assignableRoleSelector'
import { Selector } from '../../zeus/index'

export const name = 'getAssignableRoles'

/**
 * Роли приложений кооператива и пайщики, которым они назначены
 */
export const query = Selector('Query')({
  [name]: rawAssignableRoleSelector,
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
