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
  ACTIVE: { label: 'Активен', variant: 'neutral' },
  ACCEPTED_PENDING_SUPPLIER: { label: 'Ждёт акцепта', variant: 'info' },
  ACCEPTED_PENDING_SUPPLIER_INDIVIDUAL: { label: 'Ждёт акцепта', variant: 'info' },
  ACCEPTED: { label: 'Принят поставщиком', variant: 'info' },
  // SUPPLY_PREPARED = партия УЖЕ сформирована (вариант доставки выбран, для
  // экспедитора выпущена ТТН) и готова к отгрузке/приёмке на КУ — это
  // завершённое состояние, а не «в процессе». Раньше бейдж врал «готовится»,
  // расходясь со страницей партий («Готова к отгрузке») и вкладкой
  // «Поставка готова».
  SUPPLY_PREPARED: { label: 'Поставка готова', variant: 'info' },
  ACCEPTED_TO_COOP: { label: 'Принят кооперативом', variant: 'info' },
  READY_TO_RECEIVE: { label: 'Готов к выдаче', variant: 'warn' },
  RECEIVED: { label: 'Получен', variant: 'pos' },
  RETURNED: { label: 'Возвращён', variant: 'neutral' },
  CANCELLED_BY_ORDERER: { label: 'Отменён заказчиком', variant: 'neg' },
  CANCELLED_BY_SUPPLIER: { label: 'Отменён поставщиком', variant: 'neg' },
  EXPIRED_NO_THRESHOLD: { label: 'Цикл закрыт без порога', variant: 'neutral' },
  EXPIRED_NO_VOLUME: { label: 'Цикл закрыт без объёма', variant: 'neutral' },
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
