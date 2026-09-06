/**
 * Эпик 16: типизированные операции корзины Стола заказов через SDK Zeus.
 * Все GraphQL-запросы идут через `@coopenomics/sdk` (Queries/Mutations.Marketplace) —
 * raw query-строки и `sendPOST` в marketplace запрещены.
 *
 * Корзина — off-chain, одна на заказчика, инвариант «одна корзина — один КУ».
 * Сервер берёт username заказчика из JWT; coopname — из контекста.
 */
import { Mutations, Queries } from '@coopenomics/sdk'
import { client } from 'src/shared/api/client'
import type { IMarketplaceCart, IMarketplaceCheckoutResult } from '../model/types'

/** Текущая корзина заказчика (создаётся на сервере лениво, getOrCreate). */
async function getCart(): Promise<IMarketplaceCart> {
  const { [Queries.Marketplace.GetCart.name]: cart } = await client.Query(
    Queries.Marketplace.GetCart.query,
    {},
  )
  return cart as IMarketplaceCart
}

/**
 * Добавить позицию. `delivery_braname` задаёт КУ корзины, если она пуста;
 * для непустой корзины должен совпадать с её текущим КУ (инвариант на backend).
 */
async function addToCart(input: {
  offer_id: string
  quantity: number
  package_id?: string | null
  delivery_braname?: string | null
}): Promise<IMarketplaceCart> {
  const { [Mutations.Marketplace.AddToCart.name]: cart } = await client.Mutation(
    Mutations.Marketplace.AddToCart.mutation,
    { variables: { input } },
  )
  return cart as IMarketplaceCart
}

/** Задать новое количество позиции (целое, ≥ 1). */
async function updateCartItem(input: {
  offer_id: string
  quantity: number
  package_id?: string | null
}): Promise<IMarketplaceCart> {
  const { [Mutations.Marketplace.UpdateCartItem.name]: cart } = await client.Mutation(
    Mutations.Marketplace.UpdateCartItem.mutation,
    { variables: { input } },
  )
  return cart as IMarketplaceCart
}

/** Удалить позицию из корзины. */
async function removeFromCart(input: { offer_id: string; package_id?: string | null }): Promise<IMarketplaceCart> {
  const { [Mutations.Marketplace.RemoveFromCart.name]: cart } = await client.Mutation(
    Mutations.Marketplace.RemoveFromCart.mutation,
    { variables: { input } },
  )
  return cart as IMarketplaceCart
}

/** Очистить корзину (КУ сохраняется). */
async function clearCart(): Promise<IMarketplaceCart> {
  const { [Mutations.Marketplace.ClearCart.name]: cart } = await client.Mutation(
    Mutations.Marketplace.ClearCart.mutation,
    { variables: {} },
  )
  return cart as IMarketplaceCart
}

/**
 * Сменить КУ доставки корзины. Меняет витрину (каталог фильтруется по этому КУ)
 * и помечает позиции, недоступные на новом КУ (available_on_current_ku=false).
 */
async function setDeliveryPoint(delivery_braname: string): Promise<IMarketplaceCart> {
  const { [Mutations.Marketplace.SetCartDeliveryPoint.name]: cart } = await client.Mutation(
    Mutations.Marketplace.SetCartDeliveryPoint.mutation,
    { variables: { input: { delivery_braname } } },
  )
  return cart as IMarketplaceCart
}

/** Превью оформления: строки по позициям и, если членского кошелька не хватает, заявление 1110. */
export type ICheckoutPreview =
  Queries.Marketplace.CheckoutSignablePayloads.IOutput['marketplaceCheckoutSignablePayloads']
/** Строка превью оформления — по одной на позицию корзины (суммы по частям). */
export type ICheckoutSignableLine = ICheckoutPreview['lines'][number]
/** Подписанное заявление 1110 на оформление. */
export type ICheckoutSignedConvert = NonNullable<
  NonNullable<Mutations.Marketplace.CheckoutCart.IInput['input']>['signed_convert']
>

/** Строка оформления, уходящая в мутацию (offer_id + упаковка + order_hash). */
export type ICheckoutSignedLine = NonNullable<
  NonNullable<Mutations.Marketplace.CheckoutCart.IInput['input']>['lines']
>[number]

async function getCheckoutSignablePayloads(): Promise<ICheckoutPreview> {
  const { [Queries.Marketplace.CheckoutSignablePayloads.name]: result } = await client.Query(
    Queries.Marketplace.CheckoutSignablePayloads.query,
    {},
  )
  return result as ICheckoutPreview
}

/**
 * Оформить корзину в заказ-агрегат. Без `checkout_id` — новый заказ; с ним —
 * повтор непрошедшего остатка прошлого оформления в тот же заказ.
 * Позиции передаются строками превью (lines), заявлений к подписи больше нет.
 * Частичный сбой не откатывает прошедшее: возвращает failed_lines + остаток.
 */
async function checkout(
  checkout_id: string | undefined,
  lines: ICheckoutSignedLine[],
  signed_convert: ICheckoutSignedConvert | null = null,
): Promise<IMarketplaceCheckoutResult> {
  const input = { ...(checkout_id ? { checkout_id } : {}), lines, signed_convert }
  const { [Mutations.Marketplace.CheckoutCart.name]: result } = await client.Mutation(
    Mutations.Marketplace.CheckoutCart.mutation,
    { variables: { input } },
  )
  return result as IMarketplaceCheckoutResult
}

export const api = {
  getCart,
  addToCart,
  updateCartItem,
  removeFromCart,
  clearCart,
  setDeliveryPoint,
  getCheckoutSignablePayloads,
  checkout,
}
