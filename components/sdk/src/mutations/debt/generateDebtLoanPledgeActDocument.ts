import { rawGeneratedDocumentSelector } from '../../selectors/documents/documentAggregateSelector'
import { $, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'generateDebtLoanPledgeActDocument'

export const mutation = Selector('Mutation')({
  [name]: [
    {
      data: $('data', 'DebtGenerateLoanPledgeActInput!'),
      options: $('options', 'GenerateDocumentOptionsInput'),
    },
    rawGeneratedDocumentSelector,
  ],
})

export interface IInput {
  data: ModelTypes['DebtGenerateLoanPledgeActInput']
  options?: ModelTypes['GenerateDocumentOptionsInput']
}

export interface IOutput {
  [name]: ModelTypes['GeneratedDocument']
}
