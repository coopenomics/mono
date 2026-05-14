import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'markReportPeriod'

export const mutation = Selector('Mutation')({
  [name]: [
    {
      data: $('data', 'MarkReportPeriodInput!'),
    },
    true,
  ],
})

export interface IInput {
  [key: string]: unknown

  data: ModelTypes['MarkReportPeriodInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
