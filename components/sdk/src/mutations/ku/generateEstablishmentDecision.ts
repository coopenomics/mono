import { documentSelector } from '../../selectors'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'kuGenerateEstablishmentDecision'

/**
 * Сгенерировать решение совета об учреждении кооперативного участка
 */
export const mutation = Selector('Mutation')({
  [name]: [
    {
      data: $('data', 'BranchEstablishmentDecisionGenerateDocumentInput!'),
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

  data: ModelTypes['BranchEstablishmentDecisionGenerateDocumentInput']
  options?: ModelTypes['GenerateDocumentOptionsInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
