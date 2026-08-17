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

/**
 * Способ отпуска товара (Эпик 18):
 *  - `by_measure` — по мере: товар делится, заказывают произвольное количество
 *    в базовой единице; цена `price_per_unit` — за базовую единицу (кг/л/шт).
 *  - `packaged` — упаковкой: товар отпускают только целыми упаковками
 *    фиксированного содержимого (`packages`), у каждой своя цена; заказывают
 *    целое число упаковок.
 */
export type MarketplaceSaleForm = 'by_measure' | 'packaged';

export const MarketplaceSaleForms = {
  BY_MEASURE: 'by_measure',
  PACKAGED: 'packaged',
} as const satisfies Record<string, MarketplaceSaleForm>;

export const MARKETPLACE_SALE_FORMS: MarketplaceSaleForm[] = [
  MarketplaceSaleForms.BY_MEASURE,
  MarketplaceSaleForms.PACKAGED,
];

/**
 * Упаковка каталога оффера (Эпик 18). Value object в jsonb-массиве на оффере
 * (как `delivery_points`/`images`). У каждой упаковки своя цена — «управляемая
 * упаковка»: масло 0,259 кг, молоко 0,5 л, лоток яиц 12 шт. При заказе
 * упаковка снапшотится в заказ (`order.package_size` + цена за упаковку в
 * `price_per_unit`); на цепь уходит содержимое как базовое количество.
 */
export interface MarketplaceOfferPackage {
  /** Стабильный идентификатор упаковки внутри каталога оффера. */
  id: string;
  /** Содержимое одной упаковки в базовой единице оффера (0.5 = 0,5 л/кг; 12 = 12 шт). */
  size: number;
  /** Цена за одну упаковку (numeric-строка в валюте кооператива). */
  price: string;
  /** Человекочитаемая подпись упаковки («Пакет 0,5 л»); null — строится из размера. */
  label: string | null;
  /**
   * Вид упаковки словами поставщика: «пластиковая бутылка», «стекло»,
   * «картонная коробка», «корзинка (возвратная)». Справочника нет намеренно —
   * тару называет тот, кто её знает. Заказчику это важно не меньше объёма:
   * молоко в стекле и в пластике берут по-разному, а корзинку из-под яиц
   * просят вернуть (требование Игоря 2026-08-13).
   *
   * `null` — только у предложений, заведённых до появления поля: тара у них
   * не названа, и выдумывать её за поставщика нельзя. Новую упаковку без вида
   * сохранить нельзя (см. `normalizePackages`), при правке предложения
   * поставщик обязан её назвать.
   */
  package_type: string | null;
  /** Порядок показа в карточке. */
  sort_order: number;
  /** Упаковка по умолчанию (для витрины/сортировки каталога). */
  is_default: boolean;
}

export const MARKETPLACE_OFFER_MAX_PACKAGES = 12;

/**
 * Сырой вход упаковки (Эпик 18): то, что задаёт поставщик. Стабильный `id`,
 * `sort_order` и признак `is_default` доопределяет сервис при нормализации в
 * хранимую `MarketplaceOfferPackage`.
 */
export interface MarketplaceOfferPackageInput {
  /**
   * Идентификатор уже существующей упаковки предложения. Передаётся при
   * редактировании, чтобы упаковка сохранила прежний идентификатор: на него
   * ссылаются корзины заказчиков и заявки на пополнение. Пустой — новая
   * упаковка.
   */
  id?: string | null;
  size: number;
  price: string;
  label?: string | null;
  /**
   * Вид упаковки (тара) — обязателен при отпуске упаковкой: без него
   * `normalizePackages` отвечает поставщику понятным отказом. В типе он
   * необязателен потому, что при частичной правке предложения сюда же
   * сливаются уже сохранённые упаковки, а у заведённых до появления поля тары
   * нет — такую упаковку поставщик обязан назвать при первой же правке.
   */
  package_type?: string | null;
  is_default?: boolean;
}

export type {
  MarketplaceBarcodeStrategy,
} from './marketplace-inventory.types';
export {
  MarketplaceBarcodeStrategies,
} from './marketplace-inventory.types';
