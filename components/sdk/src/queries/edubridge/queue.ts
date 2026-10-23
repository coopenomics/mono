import { eduAccessTaskSelector } from '../../selectors/edubridge/adminSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'edubridgeQueue'

export const query = Selector('Query')({
  [name]: [{ filter: $('filter', 'EduQueueFilterInput') }, eduAccessTaskSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  filter?: ModelTypes['EduQueueFilterInput']
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
