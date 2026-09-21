import { eduReturnRequestSelector } from '../../selectors/edubridge/returnSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'edubridgeDeclineReturn'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'EduDeclineReturnInput!') }, eduReturnRequestSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['EduDeclineReturnInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
