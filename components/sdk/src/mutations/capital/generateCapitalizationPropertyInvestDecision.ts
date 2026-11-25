import { documentSelector } from '../../selectors'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'capitalGenerateCapitalizationPropertyInvestDecision'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'CapitalizationPropertyInvestDecisionGenerateDocumentInput!'), options: $('options', 'GenerateDocumentOptionsInput') }, documentSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['CapitalizationPropertyInvestDecisionGenerateDocumentInput']
  options?: ModelTypes['GenerateDocumentOptionsInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
