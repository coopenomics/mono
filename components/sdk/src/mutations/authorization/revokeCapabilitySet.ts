import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'revokeCapabilitySet'

/**
 * Отозвать у пайщика набор возможностей (управляет председатель).
 */
export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'RevokeCapabilitySetInput!') }, true],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['RevokeCapabilitySetInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
