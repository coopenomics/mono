import { marketplaceOrderUnitLabel } from 'src/shared/lib/consts/marketplace-units';
import type { MarketplaceOrderView } from '../../MyOrders/types';

/**
 * Story 14.1 / 14.5: группировка принятых (ACCEPTED) заказов поставщика в
 * заявки→КУ для явного формирования партии (`marketplaceCreateShipment`).
 *
 * Backend требует группу на каждый КУ заявки (1:1), поэтому заказы одной заявки
 * (cycle_id) раскладываются по пунктам выдачи (delivery_braname). Заказы без
 * cycle_id не показываем — без заявки партию не сформировать.
 */

export interface ShipmentKuGroup {
  braname: string;
  kuName: string;
  kuAddress?: string;
  ordersCount: number;
  units: number;
  sum: number;
}

export interface ShipmentFormationCycle {
  cycle_id: string;
  title: string;
  groups: ShipmentKuGroup[];
  ordersCount: number;
  sum: number;
}

/**
 * E14: одна строка заказа для dual-list формирования партии. Гранулярность —
 * целый заказ (не дробим количество): строка целиком грузится в партию или нет.
 */
export interface ShipmentOrderLine {
  id: string;
  cycle_id: string;
  title: string;
  quantity: number;
  unit: string;
  sum: number;
}

/** E14: акцептованные заказы одного КУ (через все заявки) — корзина для dual-list. */
export interface ShipmentKuBucket {
  braname: string;
  kuName: string;
  kuAddress?: string;
  lines: ShipmentOrderLine[];
}

/**
 * E14: группировка акцептованных заказов поставщика по КУ (через все заявки) —
 * для нового диалога формирования: поставщик выбирает один КУ и переносит
 * заказы-строки в партию (dual-list). Заказы без cycle_id опускаем — без заявки
 * партию не сформировать. На submit выбранные строки группируются по cycle_id
 * (одна партия = один cycle × КУ × вариант).
 */
export function groupAcceptedByKu(orders: MarketplaceOrderView[]): ShipmentKuBucket[] {
  const byKu = new Map<string, ShipmentKuBucket>();
  for (const o of orders) {
    if (!o.cycle_id) continue;
    let bucket = byKu.get(o.delivery_braname);
    if (!bucket) {
      bucket = {
        braname: o.delivery_braname,
        kuName: o.delivery_point_name || o.delivery_braname,
        kuAddress: o.delivery_point_address || undefined,
        lines: [],
      };
      byKu.set(o.delivery_braname, bucket);
    }
    bucket.lines.push({
      id: o.id,
      cycle_id: o.cycle_id,
      title: o.product_name || 'Товар по предложению',
      quantity: o.quantity,
      unit: marketplaceOrderUnitLabel(o.unit_of_measure, o.order_unit_size),
      sum: parseFloat(o.total_cost) || 0,
    });
  }
  return [...byKu.values()];
}

export function groupAcceptedOrders(orders: MarketplaceOrderView[]): ShipmentFormationCycle[] {
  const byCycle = new Map<string, MarketplaceOrderView[]>();
  for (const o of orders) {
    if (!o.cycle_id) continue;
    const list = byCycle.get(o.cycle_id);
    if (list) list.push(o);
    else byCycle.set(o.cycle_id, [o]);
  }

  const cycles: ShipmentFormationCycle[] = [];
  for (const [cycle_id, cycleOrders] of byCycle) {
    const byKu = new Map<string, MarketplaceOrderView[]>();
    for (const o of cycleOrders) {
      const list = byKu.get(o.delivery_braname);
      if (list) list.push(o);
      else byKu.set(o.delivery_braname, [o]);
    }

    const groups: ShipmentKuGroup[] = [];
    for (const [braname, kuOrders] of byKu) {
      const first = kuOrders[0];
      groups.push({
        braname,
        kuName: first.delivery_point_name || braname,
        kuAddress: first.delivery_point_address || undefined,
        ordersCount: kuOrders.length,
        units: kuOrders.reduce((acc, o) => acc + o.quantity, 0),
        sum: kuOrders.reduce((acc, o) => acc + (parseFloat(o.total_cost) || 0), 0),
      });
    }

    const first = cycleOrders[0];
    const productName = first.product_name || 'Заявка';
    const unit = marketplaceOrderUnitLabel(first.unit_of_measure, first.order_unit_size);
    cycles.push({
      cycle_id,
      title: `${productName} · №${cycle_id.slice(0, 8)} · ${unit}`,
      groups,
      ordersCount: cycleOrders.length,
      sum: cycleOrders.reduce((acc, o) => acc + (parseFloat(o.total_cost) || 0), 0),
    });
  }

  return cycles;
}
