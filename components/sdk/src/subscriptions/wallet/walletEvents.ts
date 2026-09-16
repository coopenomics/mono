import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

/**
 * Изменения кошельков пайщика.
 *
 * Подписка несёт сигнал, а не суммы: сервер публикует его на дельте цепи, а
 * клиент по сигналу дочитывает остаток авторизованным запросом — иначе payload
 * и запрос разойдутся, и на экране останется устаревшая сумма с видом свежей.
 * Топик персональный и выводится из токена соединения: чужой кошелёк в канал
 * не попадает.
 */
export const name = 'walletEvents'

export const subscription = Selector('Subscription')({
  [name]: [
    { input: $('input', 'WalletEventsInput!') },
    {
      coopname: true,
      username: true,
      wallet_name: true,
    },
  ],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  input: ModelTypes['WalletEventsInput']
}

export type IOutput = InputType<GraphQLTypes['Subscription'], typeof subscription>
