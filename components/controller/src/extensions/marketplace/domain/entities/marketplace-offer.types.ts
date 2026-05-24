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

/**
 * Маппинг domain (snake_case, PG-storage) → chain (eosio::name, без `_`).
 * Контракт p.mkt.supply ожидает `eosio::name` (см. table_marketplace_orders.hpp:
 * TIME_BASED="timebased"_n, VOLUME_BASED="volumebased"_n,
 * OPEN_SUBSCRIPT="opensubscr"_n, INDIVIDUAL="individual"_n).
 *
 * Грамматика eosio::name запрещает `_`, поэтому domain-имена `time_based`/
 * `volume_based`/`open_subscription` нельзя передавать в action как есть.
 * Использовать на boundary chain submit (`chainPort.createOrder`).
 */
export const MARKETPLACE_CYCLE_TYPE_CHAIN_NAME = {
  [MarketplaceOfferCycleTypes.TIME_BASED]: 'timebased',
  [MarketplaceOfferCycleTypes.VOLUME_BASED]: 'volumebased',
  [MarketplaceOfferCycleTypes.OPEN_SUBSCRIPTION]: 'opensubscr',
  [MarketplaceOfferCycleTypes.INDIVIDUAL]: 'individual',
} as const satisfies Record<MarketplaceOfferCycleType, string>;

export function toChainCycleType(cycle: string): string {
  const mapped = (MARKETPLACE_CYCLE_TYPE_CHAIN_NAME as Record<string, string>)[cycle];
  if (!mapped) {
    throw new Error(
      `toChainCycleType: неизвестный domain cycle_type «${cycle}»; ожидался один из ${MARKETPLACE_OFFER_CYCLE_TYPES.join(', ')}`
    );
  }
  return mapped;
}

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

export type {
  MarketplaceBarcodeStrategy,
} from './marketplace-inventory.types';
export {
  MarketplaceBarcodeStrategies,
} from './marketplace-inventory.types';
