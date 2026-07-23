import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { MarketplaceOfferStatus } from '../../domain/entities/marketplace-offer.types';

/**
 * Story 3.2: Offer Стола заказов. Pure db (не on-chain).
 * Поля под Story 3.3/3.4 проставлены сразу — миграция расширения едина.
 *
 * Hot-path индексы для каталога (Story 3.5): `(coopname, status,
 * category_id)` — фильтр-чипы; `(supplier_account, status)` — «мои оферы».
 */
@Entity({ name: 'marketplace_offer' })
@Index(['coopname', 'status', 'category_id'])
@Index(['supplier_account', 'status'])
@Index(['status', 'created_at'])
export class MarketplaceOfferEntity {
  @PrimaryGeneratedColumn('uuid')
  public id!: string;

  @Column({ type: 'varchar', length: 13 })
  public coopname!: string;

  @Column({ type: 'varchar', length: 13 })
  public supplier_account!: string;

  @Column({ type: 'varchar', length: 64 })
  public vitrine_id!: string;

  @Column({ type: 'varchar', length: 200 })
  public product_name!: string;

  @Column({ type: 'varchar', length: 2000, nullable: true })
  public description!: string | null;

  @Column({ type: 'integer' })
  public category_id!: number;

  // numeric → string в TypeORM (precision deliberately, не плодим float).
  // Цена задаётся за одну единицу заказа (фасовку размером `order_unit_size`
  // базовых единиц), не за одну базовую единицу.
  @Column({ type: 'numeric', precision: 18, scale: 4 })
  public price_per_unit!: string;

  @Column({ type: 'varchar', length: 16 })
  public unit_of_measure!: 'piece' | 'kg' | 'liter';

  /**
   * Размер единицы заказа (фасовки) в базовых единицах `unit_of_measure`.
   * За неё указана `price_per_unit`, и в ней заказчик набирает `quantity`
   * (заказ = целое число таких фасовок). Примеры: икра `kg` + 0.1 (цена за
   * 100 г), яйца `piece` + 8 (цена за упаковку 8 шт), молоко `liter` + 1.
   * Справочная цена за базовую единицу = `price_per_unit / order_unit_size`.
   * numeric → string в TypeORM.
   */
  @Column({ type: 'numeric', precision: 12, scale: 3, default: 1 })
  public order_unit_size!: string;

  @Column({ type: 'integer', default: 0 })
  public quantity_available!: number;

  @Column({ type: 'integer', default: 0 })
  public quantity_blocked!: number;

  @Column({ type: 'integer', default: 0 })
  public quantity_consumed!: number;

  @Column({ type: 'boolean', default: false })
  public unlimited_flag!: boolean;

  /**
   * КУ поставки с минимальным объёмом на каждом (Эпик 15). jsonb-массив
   * `{ braname, min_supply_volume }`. Заменяет упразднённые `cycle_type`/
   * `target_volume`: тип поставки — производная от `min_supply_volume`
   * (1 → по одному; >1 → накопление партии), порога нет.
   */
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  public delivery_points!: Array<{ braname: string; min_supply_volume: number }>;

  @Column({ type: 'integer', default: 0 })
  public warranty_days!: number;

  /**
   * Стратегия маркировки штрих-кодом per-Offer (Story 5.5 / техдолг 598-22):
   * атрибут товара, не операции маркировки оператора. Используется
   * `MarketplaceInventoryLabelService` как источник истины; per-call
   * override параметр оставлен только для admin-сценариев перекрытия.
   */
  @Column({ type: 'varchar', length: 32, default: 'PER_ORDER' })
  public barcode_strategy!: 'PER_ORDER' | 'PER_UNIT' | 'PER_PACKAGE';

  /**
   * Размер упаковки для `barcode_strategy = PER_PACKAGE`. Обязателен при
   * этой стратегии, валидируется на уровне сервиса/модерации.
   */
  @Column({ type: 'integer', nullable: true })
  public pack_size!: number | null;

  /**
   * Изображения товара (Story 3.2 доп.). jsonb-массив снапшотов объектов
   * bucket'а `stol-zakazov:images`: `{ bucket_key, content_hash, mime_type }`.
   * Порядок = порядок показа, индекс 0 — обложка. URL на чтение резолвится
   * лениво в `@ResolveField images` (HMAC-signed URL), в БД не хранится.
   * `synchronize:true` создаёт колонку ADD COLUMN с default '[]'.
   */
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  public images!: Array<{ bucket_key: string; content_hash: string; mime_type: string }>;

  /**
   * Оффер кооператива из обезличенного остатка склада КУ (requirement 76):
   * non-null = «продавец — кооператив, исполнение мгновенное со склада этого
   * КУ». Публикуется оператором отдельным действием (цена прибытия или
   * уценка), supplier_account при этом = coopname.
   */
  @Column({ type: 'varchar', length: 13, nullable: true })
  public stock_braname!: string | null;

  // Исходный оффер поставщика, из которого пришло имущество остатка:
  // группирует публикации одного товара в один оффер кооператива на КУ.
  @Column({ type: 'uuid', nullable: true })
  public stock_origin_offer_id!: string | null;

  @Column({ type: 'varchar', length: 32 })
  public status!: MarketplaceOfferStatus;

  @Column({ type: 'varchar', length: 13, nullable: true })
  public approved_by!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  public approved_at!: Date | null;

  @Column({ type: 'varchar', length: 13, nullable: true })
  public rejected_by!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  public rejected_at!: Date | null;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  public reject_reason!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  public created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  public updated_at!: Date;
}
