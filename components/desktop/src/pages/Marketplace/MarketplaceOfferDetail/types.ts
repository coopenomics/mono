/**
 * Страница полного описания предложения (Эпик 15). Тип берётся из SDK Zeus
 * IOutput запроса GetOffer — без ручного дублирования backend-схемы.
 */
import type { Queries } from '@coopenomics/sdk';

export type MarketplaceOfferDetailView = NonNullable<
  Queries.Marketplace.GetOffer.IOutput['marketplaceGetOffer']
>;
