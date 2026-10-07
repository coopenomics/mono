import { eduFundMovementSelector } from '../../selectors/edubridge/economySelector'
import { type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'edubridgeMySettlementHistory'

/** Выписка по моему паевому взносу в программе: зачисления по принятым результатам и переводы в Цифровой Кошелёк */
export const query = Selector('Query')({
  [name]: eduFundMovementSelector,
})

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
