import { eduEnrollmentSelector } from '../../selectors/edubridge/memberSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'edubridgeSubscribe'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'EduSubscribeInput!') }, eduEnrollmentSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['EduSubscribeInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
