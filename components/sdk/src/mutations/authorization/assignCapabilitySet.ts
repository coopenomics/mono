import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'assignCapabilitySet'

/**
 * Назначить пайщику набор возможностей (управляет председатель).
 */
export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'AssignCapabilitySetInput!') }, true],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['AssignCapabilitySetInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
