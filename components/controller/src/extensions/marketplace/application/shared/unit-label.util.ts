import type { MarketplaceUnitOfMeasure } from '../../domain/entities/marketplace-offer.types';

/**
 * Человекочитаемые единицы измерения для документов marketplace (АПП приёмки,
 * акт выдачи). Используется при сборке Action 1102 в обоих сервисах — приёмки и
 * выдачи, поэтому вынесено в shared (DRY).
 */
export const MARKETPLACE_UNIT_LABEL: Record<MarketplaceUnitOfMeasure, string> = {
  piece: 'шт.',
  kg: 'кг',
  liter: 'л',
};

/**
 * Пересчёт строки заказа в ФИЗИЧЕСКИЙ объём для актов АПП приёмки/выдачи.
 *
 * Заказ считается в единицах заказа (фасовках размером `order_unit_size` базовых
 * единиц), а цена — за фасовку. В юридическом акте приёма-передачи показываем
 * реальное переданное имущество в БАЗОВЫХ единицах измерения: количество =
 * `order_quantity × order_unit_size`, цена — за одну базовую единицу. Итоговая
 * сумма при этом сохраняется (`unit_cost = total / physical`), поэтому
 * `количество × цена = сумме`, уже уплаченной по заказу. Используется в обоих
 * генераторах актов (приёмка и выдача), поэтому вынесено в shared (DRY).
 */
export function toPhysicalActLine(
  orderQuantity: number,
  totalAmount: string,
  orderUnitSize: string | null | undefined,
  decimals: number
): { physicalQuantity: number; unitCostPerBase: string } {
  const size = Number.parseFloat(orderUnitSize ?? '1');
  const s = Number.isFinite(size) && size > 0 ? size : 1;
  const physicalQuantity = orderQuantity * s;
  const total = Number.parseFloat(totalAmount);
  const unitCost = physicalQuantity > 0 ? total / physicalQuantity : total;
  return { physicalQuantity, unitCostPerBase: unitCost.toFixed(decimals) };
}
