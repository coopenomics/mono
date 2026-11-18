import { documentSelector } from '../../selectors'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'kuGenerateTrustedPowerOfAttorney'

/**
 * Сгенерировать доверенность доверенному лицу участка (номер, протокол и доверенность председателя вписывает узел)
 */
export const mutation = Selector('Mutation')({
  [name]: [
    {
      data: $('data', 'BranchTrustedPowerOfAttorneyGenerateDocumentInput!'),
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

  data: ModelTypes['BranchTrustedPowerOfAttorneyGenerateDocumentInput']
  options?: ModelTypes['GenerateDocumentOptionsInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
