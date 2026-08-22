import type { BaseBadgeVariant } from 'src/shared/ui/base';
import type { DomainOrderStatus } from './toOrderCardModel';

/**
 * Единый источник человекочитаемого статуса заказа Стола заказов: подпись +
 * вариант бейджа. Раньше карта `STATUS_LABEL` дублировалась в трёх местах
 * (MyOrders, OperatorIssuance, OrdererConsolidated), а карточка показывала
 * грубый card-status («Размещён») в довесок к доменному («Ждёт поставщика») —
 * на одном заказе виднелись два разных статуса. Здесь — одна доменная карта на
 * все витрины заказов.
 *
 * Формулировки нейтральны к роли: «Ждёт акцепта» одинаково верно и для
 * заказчика (ждёт акцепта поставщика), и для поставщика (ждёт его акцепта).
 */
export interface OrderStatusDisplay {
  label: string;
  variant: BaseBadgeVariant;
}

const ORDER_STATUS_DISPLAY: Record<DomainOrderStatus, OrderStatusDisplay> = {
  // Заказ размещён, партия ещё НАКАПЛИВАЕТСЯ до минимума (поставщик пока не
  // акцептовал). «Активен» заказчику ничего не говорит, а «Ожидает
  // подтверждения» дублировало бы ACCEPTED_PENDING_SUPPLIER. Эта стадия — про
  // СБОР партии (ниже по рангу, чем «Ждёт акцепта»): «Ожидает сборки партии».
  ACTIVE: { label: 'Ожидает сборки партии', variant: 'neutral' },
  ACCEPTED_PENDING_SUPPLIER: { label: 'Ждёт акцепта', variant: 'info' },
  ACCEPTED_PENDING_SUPPLIER_INDIVIDUAL: { label: 'Ждёт акцепта', variant: 'info' },
  ACCEPTED: { label: 'Ожидает отгрузки', variant: 'info' },
  // SUPPLY_PREPARED = поставщик СОБРАЛ партию (выбран вариант доставки, для
  // экспедитора выпущена ТТН), но имущество ещё НЕ отгружено и НЕ принято на КУ
  // (приёмки ПВЗ и подписи председателя ещё не было). Поэтому «Поставка готова»
  // вводило в заблуждение — на этом этапе принят лишь акцепт поставщика. Канон-
  // термин: «Собрана к отгрузке».
  SUPPLY_PREPARED: { label: 'Собрана к отгрузке', variant: 'info' },
  ACCEPTED_TO_COOP: { label: 'Принят кооперативом', variant: 'info' },
  READY_TO_RECEIVE: { label: 'Готов к выдаче', variant: 'warn' },
  RECEIVED: { label: 'Получен', variant: 'pos' },
  RETURNED: { label: 'Возвращён', variant: 'neutral' },
  CANCELLED_BY_ORDERER: { label: 'Отменён заказчиком', variant: 'neg' },
  CANCELLED_BY_SUPPLIER: { label: 'Отменён поставщиком', variant: 'neg' },
};

/**
 * Подпись + вариант бейджа для доменного статуса заказа. Принимает и строку
 * (значения Zeus-enum'ов разных операций приходят как строковые литералы) —
 * неизвестный статус деградирует до нейтрального бейджа с исходным текстом.
 */
export function orderStatusDisplay(status: DomainOrderStatus | string): OrderStatusDisplay {
  return (
    ORDER_STATUS_DISPLAY[status as DomainOrderStatus] ?? {
      label: String(status),
      variant: 'neutral',
    }
  );
}
