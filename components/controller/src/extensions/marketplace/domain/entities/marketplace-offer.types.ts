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

/**
 * Точка поставки Offer'а: КУ, на который поставщик готов везти, и минимальный
 * объём (в единицах оффера), от которого ему интересно ехать. Pure-db value
 * object — массив на оффере (jsonb). Тип поставки как отдельная сущность
 * упразднён (Эпик 15): «индивидуально/коллективно» — производная от
 * `min_supply_volume` (1 → по одному заказу; >1 → накопление партии). Объём —
 * мягкий ориентир группировки, НЕ жёсткий порог: поставщик вправе принять и
 * меньше, и больше.
 */
export interface MarketplaceOfferDeliveryPoint {
  braname: string;
  min_supply_volume: number;
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

/**
 * Базовая физическая единица измерения товара (Эпик 17): количество и цена
 * ведутся прямо в ней — цена «за одну базовую единицу» (кг/литр/штуку),
 * количество — дробное в этой же единице. Понятие «фасовки» (`order_unit_size`)
 * упразднено; управляемая упаковка — отдельная сущность Phase 2.
 */
export type MarketplaceUnitOfMeasure = 'piece' | 'kg' | 'liter';

export const MarketplaceUnitsOfMeasure = {
  PIECE: 'piece',
  KG: 'kg',
  LITER: 'liter',
} as const satisfies Record<string, MarketplaceUnitOfMeasure>;

export const MARKETPLACE_UNITS_OF_MEASURE: MarketplaceUnitOfMeasure[] = [
  MarketplaceUnitsOfMeasure.PIECE,
  MarketplaceUnitsOfMeasure.KG,
  MarketplaceUnitsOfMeasure.LITER,
];

export type {
  MarketplaceBarcodeStrategy,
} from './marketplace-inventory.types';
export {
  MarketplaceBarcodeStrategies,
} from './marketplace-inventory.types';
