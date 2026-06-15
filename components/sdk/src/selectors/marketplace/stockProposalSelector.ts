import { Selector } from '../../zeus/index'
import { rawDocumentSelector } from '../common/documentSelector'

/**
 * Нагрузка к принятию предложения со склада: строки-заказы + ОДНО Заявление о
 * конвертации на весь дефицит (convert_document пустой, если членских средств
 * хватает — при замене из высвобожденных средств подписывать нечего).
 */
export const marketplaceStockAcceptPayloadSelector = Selector('MarketplaceStockAcceptPayload')({
  order_lines: {
    offer_id: true,
    order_hash: true,
  },
  convert_amount: true,
  convert_hash: true,
  convert_document: rawDocumentSelector,
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
