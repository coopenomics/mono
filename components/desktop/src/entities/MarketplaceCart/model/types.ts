/**
 * Эпик 16: типы корзины заказчика Стола заказов.
 *
 * Берутся из SDK Zeus IOutput соответствующих операций — backend-схема
 * (cartSelector / checkoutResultSelector) не дублируется руками.
 */
import type { Mutations, Queries } from '@coopenomics/sdk'

/** Корзина заказчика: позиции + агрегаты + выбранный КУ (delivery_braname). */
export type IMarketplaceCart = NonNullable<
  Queries.Marketplace.GetCart.IOutput['marketplaceGetCart']
>

/** Позиция корзины (оффер + кол-во + обогащение для UI). */
export type IMarketplaceCartItem = IMarketplaceCart['items'][number]

/** Результат оформления корзины: общий checkout_id, заказы, непрошедший остаток. */
export type IMarketplaceCheckoutResult =
  Mutations.Marketplace.CheckoutCart.IOutput['marketplaceCheckoutCart']

/** Непрошедшая при оформлении позиция (осталась в корзине для повтора). */
export type IMarketplaceCheckoutFailedLine =
  IMarketplaceCheckoutResult['failed_lines'][number]
