import { marketplaceOrderUnitLabel } from 'src/shared/lib/consts/marketplace-units';
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
  // Человеческое имя поставщика (ФИО физлица / «ИП …» / название организации).
  // Поставщик на этом столе — сам offerer (его собственная «Подготовка
  // отгрузки»), поэтому имя берём из сессии. Никогда не показываем braname/
  // account-id: получатель резолвится в название КУ, поставщик — в имя пайщика.
  supplierName?: string,
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
  // Адрес КУ-получателя — «куда везти». Берём из заказа (он резолвит ПВЗ).
  const recipientAddress = matched[0]?.delivery_point_address || undefined;
  const supplier = supplierName?.trim() || shipment.offerer_account;
  // Собранные в форме данные экспедитора (все опциональны) — целиком в документ.
  const t = shipment.ttn_data ?? undefined;
  // Экспедиторская упаковка по строкам: orderId → штук в коробке. Число коробок
  // выводим как ceil(quantity / units_per_box). Нужно экспедитору и оператору ПВЗ.
  const packMap = new Map((t?.packaging ?? []).map((p) => [p.order_id, p.units_per_box]));
  const qrValue = encodeHandoffToken({
    kind: HandoffTokenKind.Shipment,
    coopname,
    account: '',
    shipment_id: shipment.id,
  });
  return {
    // У партии экспедитора backend проставляет ttn_number; fallback — короткий id.
    number: shipment.ttn_number || shipment.id.slice(0, 8),
    date: shipment.created_at ? String(shipment.created_at) : new Date().toISOString(),
    supplier,
    recipient,
    recipientAddress,
    expeditorName: t?.expeditor_full_name || undefined,
    expeditorPhone: t?.expeditor_phone || undefined,
    vehicleNumber: t?.vehicle_number || undefined,
    loadingAddress: t?.loading_address || undefined,
    loadingDatetime: t?.loading_datetime || undefined,
    deliveryEstimate: t?.delivery_datetime_estimate || undefined,
    items: matched.map((o) => {
      const unitsPerBox = packMap.get(o.id);
      const boxes = unitsPerBox && unitsPerBox > 0 ? Math.ceil(o.quantity / unitsPerBox) : undefined;
      return {
        sku: o.offer_id ? String(o.offer_id).slice(0, 8) : '—',
        title: o.product_name || 'Товар по предложению',
        qty: o.quantity,
        unit: marketplaceOrderUnitLabel(o.unit_of_measure),
        price: parseFloat(o.price_per_unit) || 0,
        unitsPerBox: unitsPerBox ?? undefined,
        boxes,
      };
    }),
    // QR приёмки партии (shipment-bound) — оператор КУ сканирует с ТТН и
    // принимает строго состав этой партии (экспедитор не пайщик). Сам токен
    // печатается рядом текстом — оператор может ввести его вручную без камеры.
    qrValue,
    qrCode: qrValue,
  };
}
