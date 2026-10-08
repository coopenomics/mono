import { rawGeneratedDocumentSelector } from '../../selectors/documents/documentAggregateSelector'
import { $, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'generateDebtRepaymentStatementDocument'

export const mutation = Selector('Mutation')({
  [name]: [
    {
      data: $('data', 'DebtGenerateRepaymentStatementInput!'),
      options: $('options', 'GenerateDocumentOptionsInput'),
    },
    rawGeneratedDocumentSelector,
  ],
})

export interface IInput {
  data: ModelTypes['DebtGenerateRepaymentStatementInput']
  options?: ModelTypes['GenerateDocumentOptionsInput']
}

export interface IOutput {
  [name]: ModelTypes['GeneratedDocument']
}
