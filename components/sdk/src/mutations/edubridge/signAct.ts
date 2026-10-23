import { eduContributionSelector } from '../../selectors/edubridge/teacherSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'edubridgeSignAct'

export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'EduSignActInput!') }, eduContributionSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['EduSignActInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
