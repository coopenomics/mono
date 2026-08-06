import type { MarketplaceOrderDomainEntity } from '../../domain/entities/marketplace-order.entity';

/**
 * Заказ из остатка кооператива (requirement 76): продавец — сам кооператив.
 * Такой заказ не имеет приёмки от поставщика — имущество уже физически на
 * складе КУ, зарезервировано (`reserveStock`) прямо при создании заказа.
 * Доступность к выдаче для него считается ИНАЧЕ, чем для обычного заказа
 * (`sumReservedByOrders` вместо `sumOnWarehouseByOrders` — см. вызовы).
 */
export function isStockOrder(order: Pick<MarketplaceOrderDomainEntity, 'supplier_account' | 'coopname'>): boolean {
  return order.supplier_account === order.coopname;
}
