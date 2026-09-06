import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { Classes } from '@coopenomics/sdk'
import { useGlobalStore } from 'src/shared/store'
import { useSessionStore } from 'src/entities/Session'
import { api, type ICheckoutSignedLine } from '../api'
import type { IMarketplaceCart, IMarketplaceCartItem, IMarketplaceCheckoutResult } from './types'

const namespace = 'marketplaceCartStore'

/**
 * Эпик 16: единый стор корзины заказчика + «текущий КУ».
 *
 * Корзина хранит выбранный пункт выдачи (`delivery_braname`) — он же «текущий
 * КУ» заказчика: каталог фильтруется по нему, шапка стола его показывает и даёт
 * сменить. Поэтому отдельного стора «текущий КУ» не заводим — он живёт в
 * корзине (один заказчик — одна корзина — один КУ). Стор грузится один раз при
 * входе на стол; все мутации возвращают свежую корзину и обновляют состояние.
 */
export const useMarketplaceCartStore = defineStore(namespace, () => {
  const cart = ref<IMarketplaceCart | null>(null)
  const loading = ref(false)
  const mutating = ref(false)
  const checkingOut = ref(false)
  // Результат последнего оформления — для отдельной страницы подтверждения
  // заказа (корзина после оформления чистая, итог показываем не в ней).
  const lastCheckout = ref<IMarketplaceCheckoutResult | null>(null)

  /** Текущий КУ заказчика (null — ещё не выбран). */
  const currentBraname = computed<string | null>(() => cart.value?.delivery_braname ?? null)
  const currentPointName = computed<string | null>(
    () => cart.value?.delivery_point_name ?? null,
  )
  const items = computed<IMarketplaceCartItem[]>(() => cart.value?.items ?? [])
  const positionsCount = computed<number>(() => cart.value?.positions_count ?? 0)
  const totalQuantity = computed<number>(() => cart.value?.total_quantity ?? 0)
  const totalCost = computed<string>(() => cart.value?.total_cost ?? '0.0000')
  const hasItems = computed<boolean>(() => positionsCount.value > 0)
  const hasUnavailableItems = computed<boolean>(() =>
    items.value.some((i) => i.available_on_current_ku === false),
  )

  function itemByOffer(offerId: string): IMarketplaceCartItem | undefined {
    return items.value.find((i) => i.offer_id === offerId)
  }

  /** Загрузить корзину (лениво создаётся на сервере). */
  async function load(): Promise<void> {
    loading.value = true
    try {
      cart.value = await api.getCart()
    } finally {
      loading.value = false
    }
  }

  async function addItem(
    offer_id: string,
    quantity: number,
    delivery_braname?: string | null,
    package_id?: string | null,
  ): Promise<void> {
    mutating.value = true
    try {
      cart.value = await api.addToCart({ offer_id, quantity, package_id, delivery_braname })
    } finally {
      mutating.value = false
    }
  }

  async function setQty(offer_id: string, quantity: number, package_id?: string | null): Promise<void> {
    mutating.value = true
    try {
      cart.value = await api.updateCartItem({ offer_id, quantity, package_id })
    } finally {
      mutating.value = false
    }
  }

  async function removeItem(offer_id: string, package_id?: string | null): Promise<void> {
    mutating.value = true
    try {
      cart.value = await api.removeFromCart({ offer_id, package_id })
    } finally {
      mutating.value = false
    }
  }

  async function clear(): Promise<void> {
    mutating.value = true
    try {
      cart.value = await api.clearCart()
    } finally {
      mutating.value = false
    }
  }

  /** Сменить КУ доставки (меняет витрину). */
  async function changeDeliveryPoint(delivery_braname: string): Promise<void> {
    mutating.value = true
    try {
      cart.value = await api.setDeliveryPoint(delivery_braname)
    } finally {
      mutating.value = false
    }
  }

  /**
   * Оформление = одна мутация по строкам превью. Паевая модель: по каждой
   * строке заказчик подписывает заявление 1110 о переводе паевого взноса в
   * ЦПП «Стол заказов» на полную сумму позиции с выделением членского взноса
   * участка (по кошелькам тело идёт паевыми кошельками, взнос — членскими).
   * Превью кладёт документ в строку, здесь он подписывается ключом сессии
   * (запертый кошелёк — PIN).
   */
  async function checkout(checkout_id?: string): Promise<IMarketplaceCheckoutResult> {
    checkingOut.value = true
    try {
      const payloads = await api.getCheckoutSignablePayloads()
      const needsSignature = payloads.some((p) => !!p.document)
      // Ключ берём только когда есть что подписывать — иначе PIN не спрашиваем.
      const wifKey = needsSignature ? await useGlobalStore().ensureSigningKey() : null
      const username = useSessionStore().username
      const signer = wifKey ? new Classes.Document(wifKey) : null
      const lines: ICheckoutSignedLine[] = []
      for (const p of payloads) {
        const signed_statement =
          p.document && signer
            ? ((await signer.signDocument(p.document, username, 1)) as NonNullable<ICheckoutSignedLine['signed_statement']>)
            : null
        lines.push({
          offer_id: p.offer_id,
          package_id: p.package_id,
          order_hash: p.order_hash,
          signed_statement,
        })
      }

      const result = await api.checkout(checkout_id, lines)
      // Сервер вернул корзину с непрошедшим остатком — синхронизируем состояние.
      cart.value = result.cart
      lastCheckout.value = result
      return result
    } finally {
      checkingOut.value = false
    }
  }

  function clearLastCheckout(): void {
    lastCheckout.value = null
  }

  return {
    cart,
    loading,
    mutating,
    checkingOut,
    lastCheckout,
    clearLastCheckout,
    currentBraname,
    currentPointName,
    items,
    positionsCount,
    totalQuantity,
    totalCost,
    hasItems,
    hasUnavailableItems,
    itemByOffer,
    load,
    addItem,
    setQty,
    removeItem,
    clear,
    changeDeliveryPoint,
    checkout,
  }
})
