import { eduConnectorBindingSelector } from '../../selectors/edubridge/adminSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'edubridgeSetConnectorCredentials'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'EduSetConnectorCredentialsInput!') }, eduConnectorBindingSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['EduSetConnectorCredentialsInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
