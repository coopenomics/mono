import { eduApprovalSelector } from '../../selectors/edubridge/courseSelector'
import { $, type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

/** Договор и приложения преподавателя, которые ждут подписи председателя. */
export const name = 'edubridgeTeacherApprovals'

export const query = Selector('Query')({
  [name]: [{ username: $('username', 'String!') }, eduApprovalSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  username: string
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
