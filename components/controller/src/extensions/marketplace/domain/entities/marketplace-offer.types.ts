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

export type MarketplaceOfferCycleType = 'individual' | 'collective';

export const MarketplaceOfferCycleTypes = {
  INDIVIDUAL: 'individual',
  COLLECTIVE: 'collective',
} as const satisfies Record<string, MarketplaceOfferCycleType>;

export const MARKETPLACE_OFFER_CYCLE_TYPES: MarketplaceOfferCycleType[] = [
  MarketplaceOfferCycleTypes.INDIVIDUAL,
  MarketplaceOfferCycleTypes.COLLECTIVE,
];

/**
 * Маппинг domain → chain (eosio::name). Контракт p.mkt.supply ожидает
 * `eosio::name` (см. table_marketplace_orders.hpp: INDIVIDUAL="individual"_n,
 * COLLECTIVE="collective"_n). Domain-значения совпадают с chain-именами
 * (оба валидны как eosio::name), маппинг тождественный — оставлен явным на
 * boundary chain submit (`chainPort.createOrder`) для единой точки проверки.
 */
export const MARKETPLACE_CYCLE_TYPE_CHAIN_NAME = {
  [MarketplaceOfferCycleTypes.INDIVIDUAL]: 'individual',
  [MarketplaceOfferCycleTypes.COLLECTIVE]: 'collective',
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

/**
 * Story 3.2 (доп.): изображение Offer'а. Pure-db value object — снапшот
 * объекта в bucket'е `stol-zakazov:images` (тот же бакет, что и фото
 * гарантийного возврата, AR31). Порядок в массиве = порядок показа; индекс 0
 * трактуется как обложка карточки каталога. `content_hash` (sha256 контента)
 * нужен для дедупликации и аудита, как и в фото возврата.
 */
export interface MarketplaceOfferImage {
  bucket_key: string;
  content_hash: string;
  mime_type: string;
}

/** Технический предел числа изображений на один Offer (защита от злоупотребления). */
export const MARKETPLACE_OFFER_MAX_IMAGES = 8;

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
