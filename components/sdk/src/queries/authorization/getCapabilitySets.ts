import { capabilitySetSelector } from '../../selectors/authorization/capabilitySetSelector'
import { type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'getCapabilitySets'

/**
 * Каталог наборов возможностей с правами, которые они открывают (для страницы «Персонал»).
 */
export const query = Selector('Query')({
  [name]: capabilitySetSelector,
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
