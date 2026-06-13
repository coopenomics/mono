/**
 * Реестр всех предложений кооператива (стол администратора).
 * Источник истины — Zeus-вывод операции marketplaceListAllOffers из @coopenomics/sdk.
 */
import { Queries } from '@coopenomics/sdk';

type _RawOfferPage =
  Queries.Marketplace.ListAllOffers.IOutput['marketplaceListAllOffers'];

type _RawOffer = _RawOfferPage['items'][number];

/**
 * Zeus маппит DateTime в `unknown`. Структуру/enum'ы оставляем из Zeus, но
 * скалярную дату создания переопределяем на строку для форматирования в UI.
 */
export type AdminOfferView = Omit<_RawOffer, 'created_at'> & {
  created_at: string;
};

/** Страница предложений: обёртка из Zeus, но items со строгой датой создания. */
export type AdminOfferPage = Omit<_RawOfferPage, 'items'> & {
  items: AdminOfferView[];
};

/** Доменный статус предложения как строковый литерал (совпадает с Zeus-enum'ом). */
export type AdminOfferStatusView = `${AdminOfferView['status']}`;
