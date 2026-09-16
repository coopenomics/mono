import type { MarketplaceOrderDomainEntity } from '../../domain/entities/marketplace-order.entity';
import { packageDeltaOfOrder, type OfferPackageDelta } from './packaging.util';

/**
 * Как разложить заблокированный заказом объём предложения, когда заказ
 * закрывается: часть выбывает у поставщика насовсем, часть возвращается ему в
 * свободное (решение владельца 08.09.2026).
 */
export interface BlockedSettlement {
  /** Выбыло из предложения: имущество перешло кооперативу. */
  consumed: number;
  /** Вернулось в свободное: имущества у поставщика никто не забирал. */
  returned: number;
}

/**
 * Правило одно на все закрытия заказа: у поставщика выбывает ровно то, что он
 * физически передал кооперативу; остальное остаётся его товаром и снова
 * доступно к заказу.
 *
 * Поэтому недопоставка (заказали десять, привезли восемь) возвращается в
 * свободное: двух литров кооператив не получал, они так и стоят у поставщика.
 * А принятое кооперативом обратно не возвращается, даже если пайщик забрал не
 * всё: невыданный излишек уже оплачен поставщику и продаётся дальше
 * предложением кооператива.
 *
 * Приёмка сверх заказа в предложении не блокировалась, поэтому в разбор она не
 * входит — списываем не больше заблокированного.
 */
export function splitBlockedByReceived(orderQuantity: number, receivedByCoop: number): BlockedSettlement {
  const blocked = Math.max(0, orderQuantity);
  const received = Math.max(0, Math.min(receivedByCoop, blocked));
  return { consumed: received, returned: Number((blocked - received).toFixed(6)) };
}

/**
 * Часть движения, относящаяся к упаковке заказа: имущество отпускается целыми
 * упаковками (канон единицы отпуска), поэтому базовое количество кратно
 * содержимому и делится нацело. По мере — упаковки нет.
 */
export function orderPackageDelta(
  order: Pick<MarketplaceOrderDomainEntity, 'package_id' | 'package_size'>,
  baseQuantity: number
): OfferPackageDelta | undefined {
  return packageDeltaOfOrder({
    package_id: order.package_id,
    package_size: order.package_size,
    quantity: baseQuantity,
  });
}
