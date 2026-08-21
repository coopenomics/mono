import { eduConnectorBindingSelector } from '../../selectors/edubridge/adminSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'edubridgeSetConnectorEnabled'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'EduSetConnectorEnabledInput!') }, eduConnectorBindingSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['EduSetConnectorEnabledInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
