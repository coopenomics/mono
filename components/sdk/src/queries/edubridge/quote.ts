import { eduQuoteSelector } from '../../selectors/edubridge/memberSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'edubridgeQuote'

export const query = Selector('Query')({
  [name]: [{ data: $('data', 'EduQuoteInput!') }, eduQuoteSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['EduQuoteInput']
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
