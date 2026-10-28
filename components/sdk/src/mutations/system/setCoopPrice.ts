import { coopPriceSelector } from '../../selectors/system/coopPriceSelector'
import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

export const name = 'setCoopPrice'

/**
 * Оператор назначает кооперативу индивидуальную цену услуги в месяц
 * (0 — бесплатно). Витрина, новые и живые подписки кооператива берут её сразу.
 */
export const mutation = Selector('Mutation')({
  [name]: [{ data: $('data', 'SetCoopPriceInput!') }, coopPriceSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['SetCoopPriceInput']
}

export type IOutput = InputType<GraphQLTypes['Mutation'], typeof mutation>
