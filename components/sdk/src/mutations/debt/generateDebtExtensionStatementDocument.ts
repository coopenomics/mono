import { rawGeneratedDocumentSelector } from '../../selectors/documents/documentAggregateSelector'
import { $, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'generateDebtExtensionStatementDocument'

export const mutation = Selector('Mutation')({
  [name]: [
    {
      data: $('data', 'DebtGenerateExtensionStatementInput!'),
      options: $('options', 'GenerateDocumentOptionsInput'),
    },
    rawGeneratedDocumentSelector,
  ],
})

export interface IInput {
  data: ModelTypes['DebtGenerateExtensionStatementInput']
  options?: ModelTypes['GenerateDocumentOptionsInput']
}

export interface IOutput {
  [name]: ModelTypes['GeneratedDocument']
}
