import { $, Selector, type ModelTypes } from '../../zeus/index'
import { rawGeneratedDocumentSelector } from '../../selectors/documents/documentAggregateSelector'

export const name = 'generateExpenseProposalDecisionDocument'

export const mutation = Selector('Mutation')({
  [name]: [
    {
      data: $('data', 'ExpenseProposalDecisionGenerateDocumentInput!'),
      options: $('options', 'GenerateDocumentOptionsInput'),
    },
    rawGeneratedDocumentSelector,
  ],
})

export interface IInput {
  data: ModelTypes['ExpenseProposalDecisionGenerateDocumentInput']
  options?: ModelTypes['GenerateDocumentOptionsInput']
}

export type IOutput = {
  [name]: ModelTypes['GeneratedDocument']
}
