import { walletMovementsPageSelector } from '../../selectors/wallet/walletActivitySelector'
import { $, type GraphQLTypes, type InputType, Selector, type ModelTypes } from '../../zeus/index'

export const name = 'getMyWalletMovements'

/** Движения по кошелькам пайщика, свежие сверху; отбор по одному кошельку. */
export const query = Selector('Query')({
  [name]: [{ data: $('data', 'GetMyWalletMovementsInput!') }, walletMovementsPageSelector],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  data: ModelTypes['GetMyWalletMovementsInput']
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
