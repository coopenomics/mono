import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

/**
 * Персональный realtime-канал событий пайщика в Столе заказов.
 *
 * Подписка несёт «сигнал» (идентификаторы + минимальный контекст), а не данные:
 * получив событие, клиент дочитывает детали авторизованным query. Сервер
 * адресует события по аккаунту из JWT соединения — чужое в канал не попадает.
 *
 * Union `MarketplaceEvent` дискриминируется по `__typename`; выбирай поля
 * нужного типа через `... on`.
 */
export const name = 'marketplaceEvents'

export const subscription = Selector('Subscription')({
  [name]: [
    { input: $('input', 'MarketplaceEventsInput!') },
    {
      __typename: true,
      '...on MarketplaceOrderReadyToReceiveEvent': {
        order_id: true,
        order_hash: true,
        braname: true,
      },
      '...on MarketplaceReceptionPendingSignEvent': {
        reception_id: true,
        ku_name: true,
      },
    },
  ],
})

export interface IInput {
  /**
   * @private
   */
  [key: string]: unknown

  input: ModelTypes['MarketplaceEventsInput']
}

export type IOutput = InputType<GraphQLTypes['Subscription'], typeof subscription>
