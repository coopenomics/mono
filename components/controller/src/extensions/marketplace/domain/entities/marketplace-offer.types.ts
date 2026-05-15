/**
 * Story 3.2 / 3.3 / 3.4: типы Offer'а.
 *
 * Source-of-truth для статуса offer'а (Story 3.2 lifecycle + Story 3.3
 * модерация), типа цикла (Story 4.7 — выбор отсечки заказов; в MVP
 * Offer хранит cycle-type, Story 4.x — собственно агрегация заказов),
 * единицы измерения (Story 3.2 поле формы).
 *
 * Категории — справочник `marketplace_category` (seed 10 baseline, Story
 * 3.5 фильтр-чипы; конструктор кастомных — Out-of-MVP).
 */

export type MarketplaceOfferStatus = 'PENDING_MODERATION' | 'ACTIVE' | 'REJECTED' | 'WITHDRAWN';

export const MARKETPLACE_OFFER_STATUSES: MarketplaceOfferStatus[] = [
  'PENDING_MODERATION',
  'ACTIVE',
  'REJECTED',
  'WITHDRAWN',
];

export type MarketplaceOfferCycleType =
  | 'time_based'
  | 'volume_based'
  | 'open_subscription'
  | 'individual';

export const MARKETPLACE_OFFER_CYCLE_TYPES: MarketplaceOfferCycleType[] = [
  'time_based',
  'volume_based',
  'open_subscription',
  'individual',
];

export type MarketplaceUnitOfMeasure = 'piece' | 'kg' | 'liter' | 'pack';

export const MARKETPLACE_UNITS_OF_MEASURE: MarketplaceUnitOfMeasure[] = [
  'piece',
  'kg',
  'liter',
  'pack',
];
