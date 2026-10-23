import { shareTransferStateSelector } from '../../selectors'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'capitalTransferShare'

/**
 * Трансляция паевого взноса из Благороста в Цифровой Кошелёк по подписанному заявлению
 */
export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'CapitalTransferShareInput!') }, shareTransferStateSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['CapitalTransferShareInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
