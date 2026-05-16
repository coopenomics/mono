export type MarketplaceOfferStatus = 'PENDING_MODERATION' | 'ACTIVE' | 'REJECTED' | 'WITHDRAWN';

export const MarketplaceOfferStatuses = {
  PENDING_MODERATION: 'PENDING_MODERATION',
  ACTIVE: 'ACTIVE',
  REJECTED: 'REJECTED',
  WITHDRAWN: 'WITHDRAWN',
} as const satisfies Record<string, MarketplaceOfferStatus>;

export const MARKETPLACE_OFFER_STATUSES: MarketplaceOfferStatus[] = [
  MarketplaceOfferStatuses.PENDING_MODERATION,
  MarketplaceOfferStatuses.ACTIVE,
  MarketplaceOfferStatuses.REJECTED,
  MarketplaceOfferStatuses.WITHDRAWN,
];

export type MarketplaceOfferCycleType =
  | 'time_based'
  | 'volume_based'
  | 'open_subscription'
  | 'individual';

export const MarketplaceOfferCycleTypes = {
  TIME_BASED: 'time_based',
  VOLUME_BASED: 'volume_based',
  OPEN_SUBSCRIPTION: 'open_subscription',
  INDIVIDUAL: 'individual',
} as const satisfies Record<string, MarketplaceOfferCycleType>;

export const MARKETPLACE_OFFER_CYCLE_TYPES: MarketplaceOfferCycleType[] = [
  MarketplaceOfferCycleTypes.TIME_BASED,
  MarketplaceOfferCycleTypes.VOLUME_BASED,
  MarketplaceOfferCycleTypes.OPEN_SUBSCRIPTION,
  MarketplaceOfferCycleTypes.INDIVIDUAL,
];

export type MarketplaceUnitOfMeasure = 'piece' | 'kg' | 'liter' | 'pack';

export const MarketplaceUnitsOfMeasure = {
  PIECE: 'piece',
  KG: 'kg',
  LITER: 'liter',
  PACK: 'pack',
} as const satisfies Record<string, MarketplaceUnitOfMeasure>;

export const MARKETPLACE_UNITS_OF_MEASURE: MarketplaceUnitOfMeasure[] = [
  MarketplaceUnitsOfMeasure.PIECE,
  MarketplaceUnitsOfMeasure.KG,
  MarketplaceUnitsOfMeasure.LITER,
  MarketplaceUnitsOfMeasure.PACK,
];
