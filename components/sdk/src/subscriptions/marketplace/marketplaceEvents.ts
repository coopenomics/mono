import { $, type GraphQLTypes, type InputType, type ModelTypes, Selector } from '../../zeus/index'

/**
 * Realtime-канал событий пайщика в Столе заказов.
 *
 * Подписка несёт «сигнал» (идентификаторы + минимальный контекст), а не данные:
 * получив событие, клиент дочитывает детали авторизованным query. Персональные
 * события сервер адресует по аккаунту из JWT соединения (чужое в канал не
 * попадает); события каталога (остаток/публикация) приходят широковещательно
 * всем подписчикам кооператива.
 *
 * Union `MarketplaceEvent` дискриминируется по `__typename`; выбирай поля
 * нужного типа через `... on`.
 *
 * Внимание: поля `status` событий НЕ селектируются. У каждого события свой
 * enum-статус, а правило GraphQL SameResponseShape запрещает одно имя ответа
 * с разными типами даже в разных `... on`-фрагментах union'а — сервер
 * отклоняет весь документ на валидации, и подписка молча не открывается
 * (инцидент 2026-06-10). Статус клиенту и не нужен: по сигналу он дочитывает
 * состояние авторизованным query. Понадобится статус в payload — алиасить
 * уникально (`order_status: status` и т.п.), не возвращать имя `status`.
 */
export const name = 'marketplaceEvents'

export const subscription = Selector('Subscription')({
  [name]: [
    { input: $('input', 'MarketplaceEventsInput!') },
    {
      '__typename': true,
      '...on MarketplaceOrderReadyToReceiveEvent': {
        order_id: true,
        order_hash: true,
        braname: true,
      },
      '...on MarketplaceReceptionPendingSignEvent': {
        reception_id: true,
        ku_name: true,
      },
      '...on MarketplaceOfferStockChangedEvent': {
        offer_id: true,
        quantity_available: true,
        unlimited_flag: true,
      },
      '...on MarketplaceOfferPublishedEvent': {
        offer_id: true,
        category_id: true,
      },
      '...on MarketplaceOrderStatusChangedEvent': {
        order_id: true,
      },
      '...on MarketplaceAplReceptionStatusChangedEvent': {
        reception_id: true,
        braname: true,
      },
      '...on MarketplaceReturnClaimStatusChangedEvent': {
        claim_id: true,
        braname: true,
      },
      '...on MarketplaceOfferModerationEvent': {
        offer_id: true,
      },
      '...on MarketplacePaymentStatusChangedEvent': {
        payment_request_id: true,
      },
      '...on MarketplaceWriteoffStatusChangedEvent': {
        proposal_id: true,
      },
      '...on MarketplaceStockProposalCreatedEvent': {
        proposal_id: true,
        braname: true,
      },
      '...on MarketplaceStockProposalResolvedEvent': {
        proposal_id: true,
        braname: true,
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
