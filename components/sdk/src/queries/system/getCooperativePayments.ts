import { cooperativePaymentSelector } from '../../selectors/system/cooperativePaymentSelector'
import { $, type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'getCooperativePayments'

/**
 * История оплат кооператива: списания подписок из журнала биллинга хаба,
 * свежие сверху. Незавершённые попытки тоже входят — «оплата зависла» и
 * «оплаты не было» для совета разные вещи.
 */
export const query = Selector('Query')({
  [name]: [{ coopname: $('coopname', 'String!'), limit: $('limit', 'Int') }, cooperativePaymentSelector],
})

export interface IInput {
  /** Имя аккаунта кооператива */
  coopname: string
  /** Сколько последних списаний вернуть (по умолчанию 50, потолок 200) */
  limit?: number
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
