import { participantAccessSelector } from '../../selectors/authorization/participantAccessSelector'
import { type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'getMyAccess'

/**
 * Эффективный доступ текущего пайщика (основание гейтинга столов и страниц).
 */
export const query = Selector('Query')({
  [name]: participantAccessSelector,
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
