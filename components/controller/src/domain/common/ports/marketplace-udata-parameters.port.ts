/**
 * Контракт живёт в секции хуков `@coopenomics/innercoop`: реализует его
 * расширение Стола заказов, вызывает ядро в потоке вступления.
 */
export {
  MARKETPLACE_DOCUMENT_PARAMETERS_HOOK as MARKETPLACE_UDATA_PARAMETERS_PORT,
  type IMarketplaceDocumentParametersHook as MarketplaceUdataParametersPort,
} from '@coopenomics/innercoop';
