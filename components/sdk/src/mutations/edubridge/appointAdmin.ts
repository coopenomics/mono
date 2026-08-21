import { eduAdminSelector } from '../../selectors/edubridge/adminSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'edubridgeAppointAdmin'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'EduAdminInput!') }, eduAdminSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['EduAdminInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
