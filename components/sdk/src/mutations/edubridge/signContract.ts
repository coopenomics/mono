import { eduTeacherContractSelector } from '../../selectors/edubridge/teacherSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'edubridgeSignContract'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'EduSignContractInput!') }, eduTeacherContractSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['EduSignContractInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
