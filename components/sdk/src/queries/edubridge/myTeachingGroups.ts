import { eduGroupSelector } from '../../selectors/edubridge/groupSelector'
import { type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'edubridgeMyTeachingGroups'

/** Идущие группы курсов, к которым допущен преподаватель */
export const query = Selector('Query')({
  [name]: eduGroupSelector,
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
