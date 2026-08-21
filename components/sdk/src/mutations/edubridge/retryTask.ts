import { eduAccessTaskSelector } from '../../selectors/edubridge/adminSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'edubridgeRetryTask'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'EduRetryTaskInput!') }, eduAccessTaskSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['EduRetryTaskInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
