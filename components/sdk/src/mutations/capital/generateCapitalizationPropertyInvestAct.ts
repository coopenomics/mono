import { documentSelector } from '../../selectors'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'capitalGenerateCapitalizationPropertyInvestAct'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'GenerateProgramPropertyActInput!'), options: $('options', 'GenerateDocumentOptionsInput') }, documentSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['GenerateProgramPropertyActInput']
  options?: ModelTypes['GenerateDocumentOptionsInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
