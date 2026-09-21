import { eduReturnRequestSelector } from '../../selectors/edubridge/returnSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'edubridgeRequestReturn'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'EduRequestReturnInput!') }, eduReturnRequestSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['EduRequestReturnInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
