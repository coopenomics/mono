/**
 * Порт генерации параметров оферты ЦПП «Стол заказов» (marketplace) в Udata.
 *
 * Отдельный от capital-порта `UdataDocumentParametersPort` намеренно: marketplace —
 * самостоятельное расширение и может стоять в кооперативе без capital. Реализацию
 * предоставляет marketplace-расширение; ядро инжектит порт опционально и зовёт его в
 * registration-flow, когда выбрана программа `ProgramKey.MARKETPLACE`.
 *
 * Контракт: генерирует и персистит уникальный номер и дату соглашения для пары
 * (coopname, username). Идемпотентно — повторный вызов не перетирает уже выданные
 * значения, иначе хэш повторного рендера разойдётся с подписанным пайщиком.
 */
export interface MarketplaceUdataParametersPort {
  generateMarketplaceOfferParameters(coopname: string, username: string): Promise<void>;
}

/**
 * Символ для dependency injection.
 */
export const MARKETPLACE_UDATA_PARAMETERS_PORT = Symbol('MarketplaceUdataParametersPort');
