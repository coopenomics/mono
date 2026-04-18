import { rawGeneratedReportSelector } from '../../selectors/reports/generatedReportSelector'
import { $, type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'getReport'

export const query = Selector('Query')({
  [name]: [{ id: $('id', 'String!') }, rawGeneratedReportSelector],
})

export interface IInput {
  [key: string]: unknown

  id: string
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
