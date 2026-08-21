import { eduConvertStatementSelector } from '../../selectors/edubridge/memberSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'edubridgeConvertStatement'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'EduQuoteInput!') }, eduConvertStatementSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['EduQuoteInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
