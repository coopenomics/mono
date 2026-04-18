import { rawGeneratedReportSelector } from '../../selectors/reports/generatedReportSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'generateReport'

export const mutation = Selector('Mutation')({
  [name]: [
    {
      data: $('data', 'GenerateReportInput!'),
      organization: $('organization', 'OrganizationDataInput'),
    },
    rawGeneratedReportSelector,
  ],
})

export interface IInput {
  [key: string]: unknown

  data: ModelTypes['GenerateReportInput']
  organization?: ModelTypes['OrganizationDataInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
