import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

/**
 * Лента изменений цепи: сигнал «эти данные изменились, перечитай».
 *
 * Приходит, когда изменение уже в базе узла, — запрос по сигналу читает новое.
 * Данных строки в сигнале нет. Каналы выбирает сервер по праву пайщика: строки
 * личных таблиц (кошельки, пайщики программ) получает только их владелец и
 * совет. Без перечня таблиц — все таблицы ленты, доступные пайщику.
 */
export const name = 'chainChanges'

export const subscription = Selector('Subscription')({
  [name]: [
    { input: $('input', 'ChainChangesInput!') },
    {
      code: true,
      table: true,
      scope: true,
      primary_key: true,
      block_num: true,
    },
  ],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  input: ModelTypes['ChainChangesInput']
}

export type IOutput = InputType<GraphQLTypes['Subscription'], typeof subscription>
