import { documentSelector } from '../../selectors'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'kuGenerateTrusteePowerOfAttorney'

/**
 * Сгенерировать доверенность председателю кооперативного участка (номер, протокол и срок вписывает узел)
 */
export const mutation = Selector('Mutation')({
  [name]: [
    {
      data: $('data', 'BranchTrusteePowerOfAttorneyGenerateDocumentInput!'),
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

  data: ModelTypes['BranchTrusteePowerOfAttorneyGenerateDocumentInput']
  options?: ModelTypes['GenerateDocumentOptionsInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
