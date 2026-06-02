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

  // Полка/ячейка склада (свободная строка, напр. «A-12»). NULL — не назначена.
  @Column({ type: 'varchar', length: 64, nullable: true })
  public shelf!: string | null;

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

  @CreateDateColumn({ type: 'timestamptz' })
  public created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  public updated_at!: Date;
}
