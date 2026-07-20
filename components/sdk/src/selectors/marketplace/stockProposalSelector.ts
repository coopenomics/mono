import { Selector } from '../../zeus/index'
import { rawDocumentSelector } from '../common/documentSelector'
import { documentAggregateSelector } from '../documents/documentAggregateSelector'

/**
 * Нагрузка к ОДНОЙ подписи пайщика по докладке: по строке — order_hash и
 * подписанный оператором АПП-выдачи (агрегат для контрподписи получения), плюс
 * ОДНО Заявление о конвертации на весь дефицит (convert_document пустой, если
 * членских средств хватает — подписывать нужно только сами акты).
 */
export const marketplaceStockAcceptPayloadSelector = Selector('MarketplaceStockAcceptPayload')({
  order_lines: {
    offer_id: true,
    order_hash: true,
    signiss1_aggregate: documentAggregateSelector,
  },
  member_amount: true,
  convert_amount: true,
  convert_hash: true,
  convert_document: rawDocumentSelector,
})

/**
 * Строка к подписи оператором при формировании докладки: order_hash будущего
 * заказа + сгенерированный АПП-выдачи (rawGeneratedDocument) для первой подписи.
 */
export const marketplaceStockIssuanceOperatorLineSelector = Selector(
  'MarketplaceStockIssuanceOperatorLine'
)({
  offer_id: true,
  quantity: true,
  order_hash: true,
  unit_price: true,
  product_name: true,
  signiss1_document: rawDocumentSelector,
})

/**
 * Предложение имущества со склада кооператива (докладка, requirement 76):
 * оператор накидывает опубликованный остаток пайщику, пайщик принимает или
 * отказывается; на акцепте создаются заказы со склада.
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
  },
  status: true,
  total_cost: true,
  created_order_ids: true,
  resolved_at: true,
  created_at: true,
})
