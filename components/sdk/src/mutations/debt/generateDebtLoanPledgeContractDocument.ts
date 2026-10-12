import { rawGeneratedDocumentSelector } from '../../selectors/documents/documentAggregateSelector'
import { $, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'generateDebtLoanPledgeContractDocument'

export const mutation = Selector('Mutation')({
  [name]: [
    {
      data: $('data', 'DebtGenerateLoanPledgeContractInput!'),
      options: $('options', 'GenerateDocumentOptionsInput'),
    },
    rawGeneratedDocumentSelector,
  ],
})

export interface IInput {
  data: ModelTypes['DebtGenerateLoanPledgeContractInput']
  options?: ModelTypes['GenerateDocumentOptionsInput']
}

export interface IOutput {
  [name]: ModelTypes['GeneratedDocument']
}
