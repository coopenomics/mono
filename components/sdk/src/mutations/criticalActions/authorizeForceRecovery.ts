import { forceRecoveryAuthorizationSelector } from '../../selectors/criticalActions/forceRecoveryAuthorizationSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'authorizeForceRecovery'

/**
 * Авторизовать принудительное восстановление доступа пайщика (председатель).
 */
export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'AuthorizeForceRecoveryInput!') }, forceRecoveryAuthorizationSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['AuthorizeForceRecoveryInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
