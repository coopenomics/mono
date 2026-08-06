import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type {
  MarketplaceBarcodeFormat,
  MarketplaceInventoryOwnership,
  MarketplaceInventoryStatus,
} from '../../domain/entities/marketplace-inventory.types';

/**
 * TypeORM-сущность склада КУ. Запись рождается на приёмке кооперативом по акту
 * (`ACCEPTED_TO_COOP`), статус стартует `RECEIVED`; маркировка наклеивает
 * штрих-код (`LABELED`), выдача/возврат/списание — Эпики 6/7/8.
 *
 * Hot-path индексы:
 *   - `(coopname, barcode_value)` unique — поиск сканером при выдаче
 *     (NULL допускает множество непромаркированных позиций — NULL ≠ NULL в PG);
 *   - `(coopname, order_id, status)` — позиции per-Order;
 *   - `(coopname, braname, status)` — стол склада КУ (Эпик 9);
 *   - `(coopname, shipment_id)` — журнал per-партия.
 */
@Entity({ name: 'marketplace_inventory' })
@Index('IDX_marketplace_inventory_barcode_unique', ['coopname', 'barcode_value'], { unique: true })
@Index(['coopname', 'order_id', 'status'])
@Index(['coopname', 'braname', 'status'])
@Index(['coopname', 'shipment_id'])
// Story 8.3: cron сканирует позиции на складе (RECEIVED/LABELED) с приближающимся expiry_date.
@Index('IDX_marketplace_inventory_expiry_scan', ['coopname', 'status', 'expiry_date'])
// requirement 76: обезличенный остаток КУ (вкладка склада) и резерв под заказ из остатка.
@Index(['coopname', 'braname', 'ownership', 'status'])
@Index(['coopname', 'reserved_order_id'])
@Index(['coopname', 'published_offer_id'])
// Эпик 19: содержимое ячейки — сетка склада и гард «непустую не деактивировать».
@Index(['coopname', 'cell_id'])
export class MarketplaceInventoryEntity {
  @PrimaryGeneratedColumn('uuid')
  public id!: string;

  @Column({ type: 'varchar', length: 13 })
  public coopname!: string;

  // Штрих-код опционален: позиция лежит на складе и без маркировки.
  @Column({ type: 'varchar', length: 64, nullable: true })
  public barcode_value!: string | null;

  @Column({ type: 'varchar', length: 16, nullable: true })
  public barcode_format!: MarketplaceBarcodeFormat | null;

  @Column({ type: 'uuid' })
  public order_id!: string;

  @Column({ type: 'uuid' })
  public shipment_id!: string;

  @Column({ type: 'varchar', length: 13 })
  public braname!: string;

  @Column({ type: 'varchar', length: 32 })
  public status!: MarketplaceInventoryStatus;

  @Column({ type: 'varchar', length: 255 })
  public product_name_snapshot!: string;

  @Column({ type: 'integer' })
  public quantity_per_label!: number;

  @Column({ type: 'varchar', length: 13 })
  public orderer_account_snapshot!: string;

  /**
   * @deprecated Эпик 19 — прежняя полка свободной строкой. Код её больше не
   * читает и не пишет: адрес переехал в `cell_id` (ячейка) / `container_id`
   * (бокс). Колонка оставлена объявленной до подтверждения бэкфилла на проде —
   * `synchronize:true` дропнул бы её на старте, раньше чем миграция v13
   * успеет перенести адреса. Снимается отдельной миграцией следующим релизом.
   */
  @Column({ type: 'varchar', length: 64, nullable: true })
  public shelf!: string | null;

  // Ячейка хранения, если позиция лежит на складе напрямую (негабарит).
  // Взаимоисключающа с `container_id`; обе NULL — место ещё не назначено.
  @Column({ type: 'uuid', nullable: true })
  public cell_id!: string | null;

  // Момент и оператор приёмки кооперативом по акту. nullable — synchronize
  // добавляет колонку без backfill для исторических записей.
  @Column({ type: 'timestamptz', nullable: true })
  public received_at!: Date | null;

  @Column({ type: 'varchar', length: 13, nullable: true })
  public received_by_operator_account!: string | null;

  // Момент/оператор маркировки штрих-кодом; NULL — позиция не промаркирована.
  @Column({ type: 'timestamptz', nullable: true })
  public labeled_at!: Date | null;

  @Column({ type: 'varchar', length: 13, nullable: true })
  public labeled_by_operator_account!: string | null;

  /**
   * Story 8.3: срок годности (received_at + Offer.warranty_days * 86400);
   * nullable для бессрочных Offer'ов и legacy-записей без warranty_days.
   */
  @Column({ type: 'timestamptz', nullable: true })
  public expiry_date!: Date | null;

  // requirement 76: принадлежность позиции — адресная под заказ (ORDER) либо
  // обезличенный остаток кооператива (COOP). Default — для legacy-записей.
  @Column({ type: 'varchar', length: 8, default: 'ORDER' })
  public ownership!: MarketplaceInventoryOwnership;

  // Цена прибытия за единицу (закупочная из акта приёмки) — база публикации
  // остатка. nullable: synchronize добавляет колонку без backfill.
  @Column({ type: 'numeric', precision: 18, scale: 4, nullable: true })
  public arrival_price!: string | null;

  // Оффер кооператива, которым остаток опубликован в каталоге; NULL — нет.
  @Column({ type: 'uuid', nullable: true })
  public published_offer_id!: string | null;

  // Заказ из остатка, под который позиция зарезервирована; NULL — свободна.
  @Column({ type: 'uuid', nullable: true })
  public reserved_order_id!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  public created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  public updated_at!: Date;
}
