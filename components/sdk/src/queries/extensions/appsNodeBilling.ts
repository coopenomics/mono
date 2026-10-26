import { appsNodeBillingSelector } from '../../selectors/extensions/appsNodeBillingSelector'
import { type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'appsNodeBilling'

/**
 * Подписки кооператива у провайдера подключения, сумма к оплате и кошелёк
 * у оператора — только для показа на узле. Пополнение и смена тарифа —
 * на столе пайщика у оператора.
 */
export const query = Selector('Query')({
  [name]: appsNodeBillingSelector,
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
