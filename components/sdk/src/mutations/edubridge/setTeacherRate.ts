import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'edubridgeSetTeacherRate'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'EduSetTeacherRateInput!') }, true],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['EduSetTeacherRateInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
