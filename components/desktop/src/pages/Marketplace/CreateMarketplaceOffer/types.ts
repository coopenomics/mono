/**
 * Story 4.7: типы формы публикации Offer'а с cycle_type.
 *
 * Источник истины — backend `MarketplaceCreateOfferInputDTO`. Ручная
 * типизация — техдолг до регенерации Zeus в `@coopenomics/sdk` (как
 * на других страницах Marketplace).
 */
export type MarketplaceOfferCycleType =
  | 'time_based'
  | 'volume_based'
  | 'open_subscription'
  | 'individual';

export type MarketplaceUnitOfMeasure = 'piece' | 'kg' | 'liter' | 'pack';

/** Новое загружаемое изображение (содержимое в base64 + MIME). */
export interface MarketplaceOfferImageUpload {
  base64: string;
  mime_type: string;
}

/** Уже сохранённое изображение (приходит с backend как подписанный URL). */
export interface MarketplaceOfferImageView {
  url: string;
  mime_type: string;
  sort_order: number;
  is_cover: boolean;
}

/** Локальная запись о выбранном файле — для превью в форме до отправки. */
export interface MarketplaceOfferImageDraft {
  /** object-URL для превью (создаётся через URL.createObjectURL). */
  preview_url: string;
  /** Имя файла — для подписи и удаления. */
  name: string;
  /** Содержимое в base64 (без data-URL префикса) для отправки на backend. */
  base64: string;
  mime_type: string;
}

export interface MarketplaceCreateOfferFormState {
  product_name: string;
  description: string;
  category_id: number | null;
  price_per_unit: string;
  unit_of_measure: MarketplaceUnitOfMeasure;
  quantity_available: number | null;
  unlimited_flag: boolean;
  cycle_type: MarketplaceOfferCycleType;
  cycle_days: number | null;
  target_volume: number | null;
  max_wait_days: number | null;
  min_threshold: number | null;
  warranty_days: number;
}

export interface MarketplaceCreateOfferPayload {
  product_name: string;
  description: string | null;
  category_id: number;
  price_per_unit: string;
  unit_of_measure: MarketplaceUnitOfMeasure;
  quantity_available: number | null;
  unlimited_flag: boolean;
  cycle_type: MarketplaceOfferCycleType;
  cycle_days: number | null;
  target_volume: number | null;
  max_wait_days: number | null;
  min_threshold: number | null;
  warranty_days: number;
  /**
   * Изображения товара (base64). При создании — набор новых файлов (может
   * быть пустым). При обновлении — если передано, полностью заменяет текущий
   * набор; если опущено (undefined) — изображения не трогаются.
   */
  images?: MarketplaceOfferImageUpload[];
}

export interface MarketplaceCategoryView {
  id: number;
  display_name: string;
  sort_order: number;
}

export interface MarketplaceCreateOfferResult {
  id: string;
  status: 'PENDING_MODERATION' | 'ACTIVE' | 'REJECTED' | 'WITHDRAWN';
  product_name: string;
  cycle_type: MarketplaceOfferCycleType;
}

export interface MarketplaceUpdateOfferPayload extends MarketplaceCreateOfferPayload {
  id: string;
}

/**
 * Подмножество полей Offer'а, нужных форме для префилла при редактировании.
 * Полный DTO приходит из marketplaceListMyOffers (см. fetchMyOfferById).
 */
export interface MarketplaceOfferEditPrefill {
  id: string;
  product_name: string;
  description: string | null;
  category_id: string | number | null;
  price_per_unit: string;
  unit_of_measure: string;
  quantity_available: number;
  unlimited_flag: boolean;
  cycle_type: MarketplaceOfferCycleType;
  cycle_days: number | null;
  target_volume: number | null;
  max_wait_days: number | null;
  min_threshold: number | null;
  warranty_days: number;
  status: 'PENDING_MODERATION' | 'ACTIVE' | 'REJECTED' | 'WITHDRAWN';
  images?: MarketplaceOfferImageView[];
}
