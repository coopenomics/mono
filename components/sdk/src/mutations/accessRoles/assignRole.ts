import { rawAssignableRoleSelector } from '../../selectors/accessRoles/assignableRoleSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'assignRole'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'RoleAssignmentInput!') }, rawAssignableRoleSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['RoleAssignmentInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
