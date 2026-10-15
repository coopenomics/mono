import { eduLearnerAccountSelector } from '../../selectors/edubridge/adminSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'edubridgeMarkLearnerRemoved'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'EduMarkLearnerRemovedInput!') }, eduLearnerAccountSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['EduMarkLearnerRemovedInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
