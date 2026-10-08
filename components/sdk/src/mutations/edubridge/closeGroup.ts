import { eduGroupSelector } from '../../selectors/edubridge/groupSelector'
import { $, type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'edubridgeCloseGroup'

/** Завершить группу курса */
export const mutation = Selector('Mutation')({
  [name]: [{ id: $('id', 'ID!') }, eduGroupSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  id: string
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
