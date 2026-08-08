/**
 * Реестр всех заказов кооператива (стол администратора). Тип строки —
 * общий с ПВЗ-реестром (widgets/Marketplace/OrdersRegistryTable) — обе
 * операции (marketplaceListAllOrders / marketplaceListBranchOrders) отдают
 * идентичный MarketplaceOrderPaginationResult.
 */
export type {
  OrderRegistryPage as AdminOrderPage,
  OrderRegistryStatusView as AdminOrderStatusView,
  OrderRegistryView as AdminOrderView,
} from 'src/widgets/Marketplace/OrdersRegistryTable';
