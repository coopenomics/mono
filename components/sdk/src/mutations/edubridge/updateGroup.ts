import { eduGroupSelector } from '../../selectors/edubridge/groupSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'edubridgeUpdateGroup'

/** Изменить группу курса */
export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'EduUpdateGroupInput!') }, eduGroupSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['EduUpdateGroupInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
