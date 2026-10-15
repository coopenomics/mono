import { documentAggregateSelector } from '../../selectors/documents'
import { $, type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'edubridgeTeacherContractDocument'

/** Подписанный договор участия в хозяйственной деятельности преподавателя */
export const query = Selector('Query')({
  [name]: [{ username: $('username', 'String!') }, documentAggregateSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  username: string
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
