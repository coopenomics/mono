import { revokeKeyResultSelector } from '../../selectors/criticalActions/revokeKeyResultSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'revokeParticipantKey'

/**
 * Отозвать скомпрометированный ключ пайщика (председатель).
 */
export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'RevokeParticipantKeyInput!') }, revokeKeyResultSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['RevokeParticipantKeyInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
