import type { MarketplaceOfferStatus } from '../../domain/entities/marketplace-offer.types';

/**
 * Story 3.2: Offer Стола заказов. Pure db (не on-chain).
 * Поля под Story 3.3/3.4 проставлены сразу — миграция расширения едина.
 *
 * Hot-path индексы для каталога (Story 3.5): `(coopname, status,
 * category_id)` — фильтр-чипы; `(supplier_account, status)` — «мои оферы».
 */
export class MarketplaceOfferEntity {
  public id!: string;

  public coopname!: string;

  public supplier_account!: string;

  public vitrine_id!: string;

  public product_name!: string;

  public description!: string | null;

  public category_id!: number;

  // Цена за одну базовую единицу товара (кг/литр/штуку). numeric → string.
  public price_per_unit!: string;

  public unit_of_measure!: 'piece' | 'kg' | 'liter';

  /**
   * Способ отпуска (Эпик 18): `by_measure` — по мере (цена за базовую единицу),
   * `packaged` — упаковкой (цена за упаковку из `packages`). `synchronize:true`
   * создаёт колонку с default 'by_measure'.
   */
  public sale_form!: 'by_measure' | 'packaged';

  /**
   * Каталог упаковок при `sale_form = packaged` (Эпик 18). jsonb-массив
   * `{ id, size, price, label, package_type, sort_order, is_default,
   * quantity_available, quantity_blocked, quantity_consumed }` — у каждой
   * упаковки своя цена (управляемая упаковка), своя тара и свой остаток в
   * упаковках; счётчики движет одна SQL-команда вместе со счётчиками
   * предложения (см. адаптер репозитория). Пустой при отпуске по мере.
   */
  public packages!: Array<{
    id: string;
    size: number;
    price: string;
    label: string | null;
    /**
     * Вид упаковки словами поставщика («стекло», «корзинка»). `null` — у
     * предложений, заведённых до появления поля (в jsonb ключа просто нет).
     */
    package_type: string | null;
    sort_order: number;
    is_default: boolean;
    /**
     * Остаток по упаковкам — в упаковках. У записей до миграции V2.5.7 ключей
     * нет: маппер читает их нулём.
     */
    quantity_available?: number;
    quantity_blocked?: number;
    quantity_consumed?: number;
  }>;

  // Дробный остаток (Эпик 17): numeric в базовой единице (кг/л/шт), transformer → number.
  public quantity_available!: number;

  public quantity_blocked!: number;

  public quantity_consumed!: number;

  public unlimited_flag!: boolean;

  /**
   * КУ поставки с минимальным объёмом на каждом (Эпик 15). jsonb-массив
   * `{ braname, min_supply_volume }`. Заменяет упразднённые `cycle_type`/
   * `target_volume`: тип поставки — производная от `min_supply_volume`
   * (1 → по одному; >1 → накопление партии), порога нет.
   */
  public delivery_points!: Array<{ braname: string; min_supply_volume: number }>;

  /**
   * Срок годности имущества в днях (задаёт поставщик при создании). По нему
   * при приёмке считается `marketplace_inventory.expiry_date` — основа
   * off-chain списания скоропорта (крон Эпика 8). Не путать с `warranty_days`.
   * `synchronize:true` создаёт колонку ADD COLUMN с default 0 (миграция v11).
   */
  public shelf_life_days!: number;

  /**
   * Гарантийный срок возврата в днях (задаёт модератор при одобрении). Питает
   * on-chain `warranty_until` заказа — окно возврата имущества (`submretrn`).
   * Не путать со сроком годности `shelf_life_days`.
   */
  public warranty_days!: number;

  /**
   * Стратегия маркировки штрих-кодом per-Offer (Story 5.5 / техдолг 598-22):
   * атрибут товара, не операции маркировки оператора. Используется
   * `MarketplaceInventoryLabelService` как источник истины; per-call
   * override параметр оставлен только для admin-сценариев перекрытия.
   */
  public barcode_strategy!: 'PER_ORDER' | 'PER_UNIT' | 'PER_PACKAGE';

  /**
   * Размер упаковки для `barcode_strategy = PER_PACKAGE`. Обязателен при
   * этой стратегии, валидируется на уровне сервиса/модерации.
   */
  public pack_size!: number | null;

  /**
   * Изображения товара (Story 3.2 доп.). jsonb-массив снапшотов объектов
   * bucket'а `stol-zakazov:images`: `{ bucket_key, content_hash, mime_type }`.
   * Порядок = порядок показа, индекс 0 — обложка. URL на чтение резолвится
   * лениво в `@ResolveField images` (HMAC-signed URL), в БД не хранится.
   * `synchronize:true` создаёт колонку ADD COLUMN с default '[]'.
   */
  public images!: Array<{ bucket_key: string; content_hash: string; mime_type: string }>;

  /**
   * Оффер кооператива из обезличенного остатка склада КУ (requirement 76):
   * non-null = «продавец — кооператив, исполнение мгновенное со склада этого
   * КУ». Публикуется оператором отдельным действием (цена прибытия или
   * уценка), supplier_account при этом = coopname.
   */
  public stock_braname!: string | null;

  // Исходный оффер поставщика, из которого пришло имущество остатка:
  // группирует публикации одного товара в один оффер кооператива на КУ.
  public stock_origin_offer_id!: string | null;

  public status!: MarketplaceOfferStatus;

  public approved_by!: string | null;

  public approved_at!: Date | null;

  public rejected_by!: string | null;

  public rejected_at!: Date | null;

  public reject_reason!: string | null;

  public created_at!: Date;

  public updated_at!: Date;
}
