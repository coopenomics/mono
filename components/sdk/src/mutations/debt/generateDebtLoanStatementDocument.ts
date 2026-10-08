import { rawGeneratedDocumentSelector } from '../../selectors/documents/documentAggregateSelector'
import { $, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'generateDebtLoanStatementDocument'

export const mutation = Selector('Mutation')({
  [name]: [
    {
      data: $('data', 'DebtGenerateLoanStatementInput!'),
      options: $('options', 'GenerateDocumentOptionsInput'),
    },
    rawGeneratedDocumentSelector,
  ],
})

export interface IInput {
  data: ModelTypes['DebtGenerateLoanStatementInput']
  options?: ModelTypes['GenerateDocumentOptionsInput']
}

export interface IOutput {
  [name]: ModelTypes['GeneratedDocument']
}
