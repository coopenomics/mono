/**
 * Эпик 15: типы формы публикации Offer'а. Тип поставки упразднён — управление
 * поставкой сведено к набору КУ с минимальным объёмом на каждом
 * (`delivery_points`). min_supply_volume = 1 → поставка по одному заказу,
 * >1 → накопление партии (мягкий ориентир, не порог).
 *
 * Источник истины — backend `MarketplaceCreateOfferInputDTO`.
 */
export interface MarketplaceOfferDeliveryPoint {
  /** Кооперативный участок (ПВЗ), на который поставщик готов везти. */
  braname: string;
  /** Минимальный объём поставки на этот участок (в единицах товара, ≥ 1). */
  min_supply_volume: number;
}

export type MarketplaceUnitOfMeasure = 'piece' | 'kg' | 'liter';

/**
 * Элемент набора изображений в payload. ЛИБО новый файл (base64 + mime_type),
 * ЛИБО ссылка на уже сохранённое изображение (bucket_key — сохранить его в
 * наборе). Порядок в массиве = порядок показа, первый — обложка.
 */
export interface MarketplaceOfferImageUpload {
  base64?: string;
  mime_type?: string;
  bucket_key?: string;
}

/** Уже сохранённое изображение (приходит с backend как подписанный URL). */
export interface MarketplaceOfferImageView {
  url: string;
  /** Стабильный ключ хранилища — для сохранения изображения при правке набора. */
  bucket_key: string;
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
  /** Размер единицы заказа (фасовки) в базовых единицах, numeric как string. */
  order_unit_size: string;
  quantity_available: number | null;
  unlimited_flag: boolean;
  delivery_points: MarketplaceOfferDeliveryPoint[];
  warranty_days: number;
}

export interface MarketplaceCreateOfferPayload {
  product_name: string;
  description: string | null;
  category_id: number;
  price_per_unit: string;
  unit_of_measure: MarketplaceUnitOfMeasure;
  /** Размер единицы заказа (фасовки) в базовых единицах, numeric как string. */
  order_unit_size: string;
  quantity_available: number | null;
  unlimited_flag: boolean;
  delivery_points: MarketplaceOfferDeliveryPoint[];
  warranty_days: number;
  /**
   * Итоговый упорядоченный набор изображений (первый — обложка). При создании —
   * только новые файлы (base64). При обновлении — смесь: уже сохранённые
   * (bucket_key, остаются) + новые (base64). Если опущено (undefined) —
   * изображения не трогаются и оффер не уходит на повторную модерацию.
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
  order_unit_size?: string | null;
  quantity_available: number;
  unlimited_flag: boolean;
  delivery_points: MarketplaceOfferDeliveryPoint[];
  warranty_days: number;
  status: 'PENDING_MODERATION' | 'ACTIVE' | 'REJECTED' | 'WITHDRAWN';
  reject_reason?: string | null;
  images?: MarketplaceOfferImageView[];
}
