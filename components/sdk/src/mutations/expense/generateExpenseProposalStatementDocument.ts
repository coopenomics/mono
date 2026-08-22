import { $, Selector, type ModelTypes } from '../../zeus/index'
import { rawGeneratedDocumentSelector } from '../../selectors/documents/documentAggregateSelector'

export const name = 'generateExpenseProposalStatementDocument'

export const mutation = Selector('Mutation')({
  [name]: [
    {
      data: $('data', 'ExpenseProposalStatementGenerateDocumentInput!'),
      options: $('options', 'GenerateDocumentOptionsInput'),
    },
    rawGeneratedDocumentSelector,
  ],
})

export interface IInput {
  data: ModelTypes['ExpenseProposalStatementGenerateDocumentInput']
  options?: ModelTypes['GenerateDocumentOptionsInput']
}

export type IOutput = {
  [name]: ModelTypes['GeneratedDocument']
}
