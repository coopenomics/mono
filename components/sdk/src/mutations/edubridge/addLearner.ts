import { eduLearnerSelector } from '../../selectors/edubridge/memberSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'edubridgeAddLearner'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'EduLearnerInput!') }, eduLearnerSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['EduLearnerInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
