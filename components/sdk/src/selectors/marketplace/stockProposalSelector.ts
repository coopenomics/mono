import { Selector } from '../../zeus/index'
import { rawDocumentSelector } from '../common/documentSelector'
import { rawIssuanceSagaSelector } from './issuanceSagaSelector'
import { rawConvertPayloadSelector } from './cartSelector'

/**
 * Нагрузка к ОДНОЙ подписи пайщика по бандлу выдачи: по строке — заказ (или
 * будущий заказ из остатка) и заявление о возврате паевого взноса имуществом;
 * если внутреннего членского кошелька не хватает на бандл — одно заявление
 * 1110 о переводе недостающей суммы со свободного паевого программы.
 */
export const marketplaceStockAcceptPayloadSelector = Selector('MarketplaceStockAcceptPayload')({
  order_lines: {
    offer_id: true,
    order_id: true,
    order_hash: true,
    statement: rawDocumentSelector,
  },
  convert: rawConvertPayloadSelector,
})

/**
 * Строка подготовки докладки: детерминированный order_hash будущего заказа и
 * снапшоты цены/упаковки. Оператор ничего не подписывает — его подпись
 * закрывающая, после подписи акта пайщиком.
 */
export const marketplaceStockIssuanceOperatorLineSelector = Selector(
  'MarketplaceStockIssuanceOperatorLine'
)({
  offer_id: true,
  quantity: true,
  order_hash: true,
  unit_price: true,
  product_name: true,
  package_id: true,
  package_size: true,
})

/**
 * Бандл выдачи у стойки (requirement 76 + компонент 68): оператор собирает
 * заказы пайщика к выдаче и/или докладку из опубликованного остатка; пайщик
 * одной подписью подписывает заявления по строкам, дальше по каждому заказу
 * идёт сага выдачи.
 */
export const marketplaceStockProposalSelector = Selector('MarketplaceStockProposal')({
  id: true,
  braname: true,
  member_account: true,
  operator_account: true,
  items: {
    offer_id: true,
    quantity: true,
    unit_price: true,
    product_name: true,
    unit_of_measure: true,
    package_size: true,
    package_label: true,
    order_id: true,
    order_hash: true,
  },
  status: true,
  total_cost: true,
  created_order_ids: true,
  resolved_at: true,
  created_at: true,
})

/** Результат подписи бандла: бандл, заказы и саги выдачи по ним. */
export const marketplaceStockProposalAcceptResultSelector = Selector('MarketplaceStockProposalAcceptResult')({
  proposal: marketplaceStockProposalSelector,
  order_ids: true,
  sagas: rawIssuanceSagaSelector,
})
