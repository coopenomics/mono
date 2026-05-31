import { marketplaceUnitShort } from 'src/shared/lib/consts/marketplace-units';
import { encodeHandoffToken, HandoffTokenKind } from 'src/shared/lib/marketplace';
import type { TTNData } from 'src/widgets/Marketplace/TTNPrintPreview';
import type { MarketplaceShipmentView } from '../api';
import type { MarketplaceOrderView } from '../../MyOrders/types';

/**
 * Story 14.5: сборка данных ТТН для печати/скачивания из сформированной партии
 * и её заказов.
 *
 * Партия (`MarketplaceShipmentView`) хранит только агрегат (сумма, ТТН-данные
 * экспедитора), без позиций. Состав ТТН восстанавливается из заказов цикла на
 * том же КУ (`cycle_id` + `delivery_braname` == `braname` партии) — после
 * формирования партии эти заказы в статусе `SUPPLY_PREPARED`.
 */
export function buildTtnData(
  shipment: MarketplaceShipmentView,
  orders: MarketplaceOrderView[],
  coopname: string,
): TTNData {
  // Состав партии — по прямой связи order.shipment_id (обязательно при нескольких
  // частичных партиях на одном КУ); fallback на (cycle, КУ) для старых партий.
  const byShipment = orders.filter((o) => o.shipment_id === shipment.id);
  const matched = byShipment.length
    ? byShipment
    : orders.filter(
        (o) => o.cycle_id === shipment.cycle_id && o.delivery_braname === shipment.braname,
      );
  const recipient = matched[0]?.delivery_point_name || shipment.braname;
  return {
    // У партии экспедитора backend проставляет ttn_number; fallback — короткий id.
    number: shipment.ttn_number || shipment.id.slice(0, 8),
    date: shipment.created_at ? String(shipment.created_at) : new Date().toISOString(),
    supplier: shipment.offerer_account,
    recipient,
    items: matched.map((o) => ({
      sku: o.offer_id ? String(o.offer_id).slice(0, 8) : '—',
      title: o.product_name,
      qty: o.quantity,
      unit: marketplaceUnitShort(o.unit_of_measure),
      price: parseFloat(o.price_per_unit) || 0,
    })),
    dispatchedBy: shipment.offerer_account,
    // QR приёмки партии (shipment-bound) — оператор КУ сканирует с ТТН и
    // принимает строго состав этой партии (экспедитор не пайщик).
    qrValue: encodeHandoffToken({
      kind: HandoffTokenKind.Shipment,
      coopname,
      account: '',
      shipment_id: shipment.id,
    }),
  };
}
