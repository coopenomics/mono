import { rawReportsFundsRegistrySelector } from '../../selectors/reports/fundSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'reportsFunds'

/** Фонды кооператива с остатками кошельков и оборотами за период (стол бухгалтера). */
export const query = Selector('Query')({
  [name]: [{ input: $('input', 'ReportsFundsInput!') }, rawReportsFundsRegistrySelector],
})

export interface IInput {
  [key: string]: unknown

  input: ModelTypes['ReportsFundsInput']
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
