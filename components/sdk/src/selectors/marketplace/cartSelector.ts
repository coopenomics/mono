import { Selector, type ValueTypes } from '../../zeus/index'
import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'
import { rawOrderSelector } from './orderSelector'

/** Эпик 16: позиция корзины (оффер + кол-во + обогащение для UI). */
const rawCartItemSelector = {
  id: true,
  offer_id: true,
  package_id: true,
  package_label: true,
  sale_form: true,
  quantity: true,
  product_name: true,
  unit_of_measure: true,
  price_per_unit: true,
  line_total: true,
  image_url: true,
  available_on_current_ku: true,
  blocker: true,
  max_available: true,
}

const _validateCartItem: MakeAllFieldsRequired<ValueTypes['MarketplaceCartItem']> = rawCartItemSelector

/** Эпик 16: корзина заказчика с позициями. */
const rawCartSelector = {
  id: true,
  delivery_braname: true,
  delivery_point_name: true,
  items: rawCartItemSelector,
  positions_count: true,
  total_quantity: true,
  total_cost: true,
}

const _validateCart: MakeAllFieldsRequired<ValueTypes['MarketplaceCart']> = rawCartSelector

export const marketplaceCartSelector = Selector('MarketplaceCart')(rawCartSelector)

/** Эпик 16: непрошедшая позиция оформления. */
const rawCheckoutFailedLineSelector = {
  offer_id: true,
  product_name: true,
  quantity: true,
  reason: true,
}

const _validateFailedLine: MakeAllFieldsRequired<ValueTypes['MarketplaceCheckoutFailedLine']> =
  rawCheckoutFailedLineSelector

/** Эпик 16: результат оформления заказа из корзины. */
const rawCheckoutResultSelector = {
  checkout_id: true,
  delivery_braname: true,
  created_orders: rawOrderSelector,
  failed_lines: rawCheckoutFailedLineSelector,
  fully_completed: true,
  cart: rawCartSelector,
}

const _validateCheckoutResult: MakeAllFieldsRequired<ValueTypes['MarketplaceCheckoutResult']> =
  rawCheckoutResultSelector

export const marketplaceCheckoutResultSelector = Selector('MarketplaceCheckoutResult')(
  rawCheckoutResultSelector
)

/**
 * Заявление о конвертации паевого взноса к подписи по позиции корзины /
 * строке предложения со склада (подписывается заказчиком при оформлении).
 */
const rawCheckoutSignableLineSelector = {
  offer_id: true,
  package_id: true,
  order_hash: true,
  amount: true,
}

const _validateSignableLine: MakeAllFieldsRequired<ValueTypes['MarketplaceCheckoutSignableLine']> =
  rawCheckoutSignableLineSelector

export const marketplaceCheckoutSignableLineSelector = Selector('MarketplaceCheckoutSignableLine')(
  rawCheckoutSignableLineSelector
)
