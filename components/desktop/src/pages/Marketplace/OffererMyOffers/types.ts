/**
 * Эпик 3 / Story 3.4: типы offerer-стола «Мои предложения».
 * Источник истины — Zeus-вывод операции marketplaceListMyOffers из @coopenomics/sdk.
 */

import { Queries } from '@coopenomics/sdk';

export type MarketplaceOfferPage =
  Queries.Marketplace.ListMyOffers.IOutput['marketplaceListMyOffers'];

export type MarketplaceOfferView = MarketplaceOfferPage['items'][number];

/**
 * Источник статусов/типов цикла — Zeus-enum'ы из @coopenomics/sdk. Берём
 * строковое значение поля Zeus-вывода (`${...}`), чтобы UI-карты статусов и
 * фильтры одинаково принимали и строковые литералы, и enum-значения из
 * самих предложений.
 */
export type MarketplaceOfferStatusView = `${MarketplaceOfferView['status']}`;
