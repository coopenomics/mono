import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'
import { entrySelector } from '../../queries/cardcoop/getEntry'

export const name = 'cardcoopRequestEntryDisclosure'

/**
 * Запросить перенос анкеты из выбранного кооператива.
 *
 * Решение принимает держатель на card.coop; стол ждёт его, опрашивая сессию входа.
 */
export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'CardcoopRequestEntryDisclosureInput!') }, entrySelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['CardcoopRequestEntryDisclosureInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
