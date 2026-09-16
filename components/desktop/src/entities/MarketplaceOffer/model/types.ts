/**
 * Полная карточка предложения. Тип берётся из SDK Zeus IOutput запроса
 * GetOffer — без ручного дублирования схемы бэкенда.
 */
import type { Queries } from '@coopenomics/sdk';

export type MarketplaceOfferDetailView = NonNullable<
  Queries.Marketplace.GetOffer.IOutput['marketplaceGetOffer']
>;
