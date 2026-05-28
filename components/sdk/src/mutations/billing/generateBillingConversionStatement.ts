import { documentSelector } from '../../selectors'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'generateBillingConversionStatement'

export const mutation = Selector('Mutation')({
  [name]: [
    {
      data: $('data', 'BillingConversionStatementGenerateDocumentInput!'),
      options: $('options', 'GenerateDocumentOptionsInput'),
    },
    documentSelector,
  ],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['BillingConversionStatementGenerateDocumentInput']
  options?: ModelTypes['GenerateDocumentOptionsInput']
}
export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
