import { operatorWalletSelector } from '../../selectors/wallet/operatorWalletSelector'
import { type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'getOperatorWallets'

/**
 * Получение балансов кошельков кооператива как пайщика-организации на бэкенде кооператива-оператора
 */
export const query = Selector('Query')({
  [name]: operatorWalletSelector,
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
