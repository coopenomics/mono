/**
 * Реестр заказов — общий вид строки. Источник истины — Zeus-вывод операций
 * marketplaceListAllOrders (стол администратора, все заказы кооператива) и
 * marketplaceListBranchOrders (стол ПВЗ, заказы одного КУ) — обе отдают
 * идентичный MarketplaceOrderPaginationResult, поэтому один тип на оба стола.
 */
import { Queries } from '@coopenomics/sdk';
import { t } from 'src/shared/i18n';

type _RawOrderPage = Queries.Marketplace.ListAllOrders.IOutput['marketplaceListAllOrders'];
type _RawOrder = _RawOrderPage['items'][number];

/** Zeus маппит DateTime в `unknown`. Структуру/enum'ы оставляем из Zeus, скалярную дату создания — строкой для форматирования в UI. */
export type OrderRegistryView = Omit<_RawOrder, 'created_at'> & {
  created_at: string;
};

/** Страница заказов: обёртка из Zeus, но items со строгой датой создания. */
export type OrderRegistryPage = Omit<_RawOrderPage, 'items'> & {
  items: OrderRegistryView[];
};

/** Доменный статус заказа как строковый литерал (совпадает с Zeus-enum'ом). */
export type OrderRegistryStatusView = `${OrderRegistryView['status']}`;

/** Полный набор статусов для чипов-фильтра (порядок — по жизненному циклу). */
export const ALL_ORDER_REGISTRY_STATUSES: OrderRegistryStatusView[] = [
  'ACTIVE',
  'ACCEPTED_PENDING_SUPPLIER',
  'ACCEPTED_PENDING_SUPPLIER_INDIVIDUAL',
  'ACCEPTED',
  'SUPPLY_PREPARED',
  'ACCEPTED_TO_COOP',
  'READY_TO_RECEIVE',
  'ISSUE_PENDING',
  'ISSUE_AUTHORIZED',
  'ISSUE_ACT1',
  'RECEIVED',
  'RETURNED',
  'CANCELLED_BY_ORDERER',
  'CANCELLED_BY_SUPPLIER',
];

/** Пункт фильтра: одна понятная позиция в меню, за ней — один или два статуса. */
export interface OrderRegistryFilterOption {
  key: string;
  label: string;
  statuses: OrderRegistryStatusView[];
}

/**
 * Меню фильтра по состоянию заказа. Пункт «Ждёт акцепта» покрывает сразу два
 * статуса: заказ, дождавшийся сборки партии, и одиночный заказ, попавший к
 * поставщику сразу. Для администратора это одно и то же ожидание, а двумя
 * пунктами с одинаковой подписью список выглядел как ошибка.
 */
export const ORDER_REGISTRY_FILTERS: OrderRegistryFilterOption[] = [
  { key: 'active', label: t('marketplace.order.status.pendingAssembly'), statuses: ['ACTIVE'] },
  {
    key: 'pending_supplier',
    label: t('marketplace.order.status.pendingSupplierAcceptance'),
    statuses: ['ACCEPTED_PENDING_SUPPLIER', 'ACCEPTED_PENDING_SUPPLIER_INDIVIDUAL'],
  },
  { key: 'accepted', label: t('marketplace.order.status.pendingShipment'), statuses: ['ACCEPTED'] },
  { key: 'supply_prepared', label: t('marketplace.order.status.readyToShip'), statuses: ['SUPPLY_PREPARED'] },
  { key: 'accepted_to_coop', label: t('marketplace.order.status.acceptedByCoop'), statuses: ['ACCEPTED_TO_COOP'] },
  { key: 'ready', label: t('marketplace.order.status.readyToIssue'), statuses: ['READY_TO_RECEIVE'] },
  { key: 'issue_pending', label: t('marketplace.order.status.councilPending'), statuses: ['ISSUE_PENDING'] },
  { key: 'issue_authorized', label: t('marketplace.order.status.councilApproved'), statuses: ['ISSUE_AUTHORIZED'] },
  { key: 'issue_act1', label: t('marketplace.order.status.actSignedIssuing'), statuses: ['ISSUE_ACT1'] },
  { key: 'received', label: t('marketplace.order.status.received'), statuses: ['RECEIVED'] },
  { key: 'returned', label: t('marketplace.order.status.returned'), statuses: ['RETURNED'] },
  { key: 'cancelled_orderer', label: t('marketplace.order.status.cancelledByOrderer'), statuses: ['CANCELLED_BY_ORDERER'] },
  { key: 'cancelled_supplier', label: t('marketplace.order.status.cancelledBySupplier'), statuses: ['CANCELLED_BY_SUPPLIER'] },
];
