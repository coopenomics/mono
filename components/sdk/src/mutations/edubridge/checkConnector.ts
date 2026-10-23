import { eduConnectorBindingSelector } from '../../selectors/edubridge/adminSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'edubridgeCheckConnector'

export const mutation = Selector('Mutation')({
  [name]: [{ carrier: $('carrier', 'EduAccessCarrier!') }, eduConnectorBindingSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  carrier: ModelTypes['EduAccessCarrier']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
