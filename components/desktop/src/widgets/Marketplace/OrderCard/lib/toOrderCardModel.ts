import { Queries } from '@coopenomics/sdk';
import { marketplaceOrderSaleUnit } from 'src/shared/lib/consts/marketplace-units';
import type { Order, OrderStatus } from '../OrderCard.vue';
import { orderStatusDisplay } from './orderStatusDisplay';

/**
 * Единый маппер доменного заказа в модель карточки `OrderCard`. Вынесен из
 * страниц «Мои заказы» и «Входящие заказы» — обе строили карточку одинаково
 * (статус-карта + реквизиты товара/ПВЗ), что нарушало DRY. Источник статусов —
 * Zeus-вывод из @coopenomics/sdk, чтобы карта была исчерпывающей по enum'у.
 */

type RawOrder =
  Queries.Marketplace.ListMyOrders.IOutput['marketplaceListMyOrders']['items'][number];

/** Доменный статус заказа как строковый литерал (совпадает с MarketplaceOrderStatusView). */
export type DomainOrderStatus = `${RawOrder['status']}`;

// Доменный статус → стандартизированный статус карточки с цветной точкой (UX-DR20).
const STATUS_TO_CARD: Record<DomainOrderStatus, OrderStatus> = {
  ACTIVE: 'placed',
  ACCEPTED_PENDING_SUPPLIER: 'placed',
  ACCEPTED_PENDING_SUPPLIER_INDIVIDUAL: 'placed',
  ACCEPTED: 'paid',
  SUPPLY_PREPARED: 'in-delivery',
  ACCEPTED_TO_COOP: 'in-delivery',
  READY_TO_RECEIVE: 'ready-to-issue',
  RECEIVED: 'issued',
  RETURNED: 'returned',
  CANCELLED_BY_ORDERER: 'cancelled',
  CANCELLED_BY_SUPPLIER: 'cancelled',
};

/** Минимальный набор полей заказа, нужный карточке (структурно). */
export interface OrderCardSource {
  id: string;
  product_name?: string | null;
  quantity: number;
  unit_of_measure?: string | null;
  /** Содержимое упаковки в базовой единице (Эпик 18); 0/null — отпуск по мере. */
  package_size?: number | null;
  total_cost: string;
  /** Членский взнос, включённый в стоимость заказа (requirement b6) — on-chain, null до первой sync-дельты. */
  membership_fee?: string | null;
  /** Готовая сумма total_cost + membership_fee (считает бэк — см. toMarketplaceOrderDTO). */
  total_cost_with_fee: string;
  status: DomainOrderStatus;
  /**
   * Оператор пункта объявил заказ готовым к выдаче. В бандл-модели заказчик почти
   * не видит on-chain READY_TO_RECEIVE (он схлопнут с получением), поэтому это
   * единственный ранний сигнал «приходите заберите»: при флаге на статусе
   * ACCEPTED_TO_COOP карточка показывает «Готов к выдаче».
   */
  is_ready_announced?: boolean;
  created_at: string | Date;
  delivery_braname: string;
  delivery_point_name?: string | null;
  delivery_point_address?: string | null;
  delivery_point_lat?: number | null;
  delivery_point_lng?: number | null;
}

/**
 * `role` определяет, что показывает «Сумма» карточки (requirement b6):
 *  - 'orderer' (по умолчанию) — цена С членским взносом, как в каталоге:
 *    это то, что заказчик реально платит.
 *  - 'offerer' — себестоимость поставщика БЕЗ взноса (его деньги), плюс
 *    отдельная строка «Цена для заказчика» с суммой для справки.
 */
export function toOrderCardModel(o: OrderCardSource, role: 'orderer' | 'offerer' = 'orderer'): Order {
  const name = o.delivery_point_name || undefined;
  const address = o.delivery_point_address || undefined;
  // Объявленная готовность к выдаче показывается заказчику как «Готов к выдаче»,
  // хотя on-chain статус ещё ACCEPTED_TO_COOP (переиспользуем вид READY_TO_RECEIVE).
  const announcedReady = !!o.is_ready_announced && o.status === 'ACCEPTED_TO_COOP';
  const display = announcedReady
    ? orderStatusDisplay('READY_TO_RECEIVE')
    : orderStatusDisplay(o.status);
  const rawCost = parseFloat(o.total_cost) || 0;
  const isOfferer = role === 'offerer';
  const feeAmount = Number(o.membership_fee ?? 0);
  const saleUnit = marketplaceOrderSaleUnit(o.quantity, o.unit_of_measure, o.package_size);
  return {
    id: o.id,
    shortId: o.id.slice(0, 8),
    title: o.product_name || 'Товар по предложению',
    units: saleUnit.units,
    unitLabel: saleUnit.unitLabel,
    totalCost: isOfferer ? rawCost : Number(o.total_cost_with_fee),
    feeNote:
      isOfferer && feeAmount > 0
        ? `Цена для заказчика: ${new Intl.NumberFormat('ru-RU').format(Number(o.total_cost_with_fee))} ₽`
        : undefined,
    status: announcedReady ? 'ready-to-issue' : STATUS_TO_CARD[o.status],
    // Бейдж карточки рисуем по доменному статусу (исчерпывающая карта), а не по
    // грубому card-status — иначе на карточке два разных текста статуса.
    statusLabel: display.label,
    statusVariant: display.variant,
    // Отмена заказчиком разрешена только до акцепта поставщика (Story 4.4 —
    // C++ guard status==ACTIVE).
    cancellable: o.status === 'ACTIVE',
    createdAt: o.created_at,
    // Имя КУ — основная строка ПВЗ, адрес — вторичная. Если нет ни имени, ни
    // адреса — показываем служебный braname, чтобы ПВЗ не исчез из карточки.
    pvzName: name ?? (address ? undefined : o.delivery_braname),
    pvz: address,
    // Координаты ПВЗ для карты «куда ехать» (живой геокод КУ). Может не быть,
    // если участок ещё не геокодирован — тогда карта на карточке не предлагается.
    pvzLat: o.delivery_point_lat ?? undefined,
    pvzLng: o.delivery_point_lng ?? undefined,
  };
}
