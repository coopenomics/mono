import { userWalletSelector } from '../../selectors/wallet/userWalletSelector'
import { $, type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'getUserWallets'

/**
 * Кошельки пайщика «как есть» — каждый кошелёк отдельной строкой, без
 * сворачивания паевого и членского в один баланс.
 */
export const query = Selector('Query')({
  [name]: [
    {
      username: $('username', 'String!'),
      coopname: $('coopname', 'String'),
    },
    userWalletSelector,
  ],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  username: string
  coopname?: string
}

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
