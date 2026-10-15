import { eduAssignmentSelector } from '../../selectors/edubridge/teacherSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'edubridgeSetAssignmentRate'

/** Задать ставку часа преподавателя на курсе */
export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'EduSetAssignmentRateInput!') }, eduAssignmentSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['EduSetAssignmentRateInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
