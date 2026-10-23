import { eduGroupSelector } from '../../selectors/edubridge/groupSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'edubridgeCreateGroup'

/** Открыть новую группу курса */
export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'EduCreateGroupInput!') }, eduGroupSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['EduCreateGroupInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
