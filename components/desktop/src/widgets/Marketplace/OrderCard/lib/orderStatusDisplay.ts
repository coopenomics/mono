import type { BaseBadgeVariant } from 'src/shared/ui/base';
import type { DomainOrderStatus } from './toOrderCardModel';
import { t } from 'src/shared/i18n';

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
  ACTIVE: { label: t('marketplace.order.status.pendingAssembly'), variant: 'neutral' },
  ACCEPTED_PENDING_SUPPLIER: { label: t('marketplace.order.status.pendingAcceptance'), variant: 'info' },
  ACCEPTED_PENDING_SUPPLIER_INDIVIDUAL: { label: t('marketplace.order.status.pendingAcceptance'), variant: 'info' },
  ACCEPTED: { label: t('marketplace.order.status.pendingShipment'), variant: 'info' },
  // SUPPLY_PREPARED = поставщик СОБРАЛ партию (выбран вариант доставки, для
  // экспедитора выпущена ТТН), но имущество ещё НЕ отгружено и НЕ принято на КУ
  // (приёмки ПВЗ и подписи председателя ещё не было). Поэтому «Поставка готова»
  // вводило в заблуждение — на этом этапе принят лишь акцепт поставщика. Канон-
  // термин: «Собрана к отгрузке».
  SUPPLY_PREPARED: { label: t('marketplace.order.status.readyToShip'), variant: 'info' },
  ACCEPTED_TO_COOP: { label: t('marketplace.order.status.acceptedByCoop'), variant: 'info' },
  READY_TO_RECEIVE: { label: t('marketplace.order.status.readyToIssue'), variant: 'warn' },
  // Паевая модель (компонент 68): заявление подано, совет решает; согласовал —
  // ждём акт пайщика; акт подписан — оператор закрывает выдачу.
  ISSUE_PENDING: { label: t('marketplace.order.status.councilPending'), variant: 'info' },
  ISSUE_AUTHORIZED: { label: t('marketplace.order.status.councilApproved'), variant: 'warn' },
  ISSUE_ACT1: { label: t('marketplace.order.status.actSignedIssuing'), variant: 'pos' },
  RECEIVED: { label: t('marketplace.order.status.received'), variant: 'pos' },
  RETURNED: { label: t('marketplace.order.status.returned'), variant: 'neutral' },
  CANCELLED_BY_ORDERER: { label: t('marketplace.order.status.cancelledByOrderer'), variant: 'neg' },
  CANCELLED_BY_SUPPLIER: { label: t('marketplace.order.status.cancelledBySupplier'), variant: 'neg' },
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
