import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'edubridgeDismissAdmin'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'EduAdminInput!') }, true],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['EduAdminInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
