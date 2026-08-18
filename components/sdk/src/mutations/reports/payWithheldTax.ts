import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'payWithheldTax'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'PayWithheldTaxInput!') }, true],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['PayWithheldTaxInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
