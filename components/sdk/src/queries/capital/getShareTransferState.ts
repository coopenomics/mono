import { shareTransferStateSelector } from '../../selectors'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'capitalShareTransferState'

/**
 * Паевой взнос пайщика на кошельке Благороста, доступный для трансляции
 */
export const query = Selector('Query')({
  [name]: [{ data: $('data', 'CapitalShareTransferStateInput!') }, shareTransferStateSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['CapitalShareTransferStateInput']
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
