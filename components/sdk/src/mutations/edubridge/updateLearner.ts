import { eduLearnerSelector } from '../../selectors/edubridge/memberSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'edubridgeUpdateLearner'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'EduUpdateLearnerInput!') }, eduLearnerSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['EduUpdateLearnerInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
