import { documentSelector } from '../../selectors'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'kuGenerateTrusteeLiabilityAgreement'

/**
 * Сгенерировать договор о полной материальной ответственности председателя участка
 */
export const mutation = Selector('Mutation')({
  [name]: [
    {
      data: $('data', 'BranchTrusteeLiabilityAgreementGenerateDocumentInput!'),
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

  data: ModelTypes['BranchTrusteeLiabilityAgreementGenerateDocumentInput']
  options?: ModelTypes['GenerateDocumentOptionsInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
