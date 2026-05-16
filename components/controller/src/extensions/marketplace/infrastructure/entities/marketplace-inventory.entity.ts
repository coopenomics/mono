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
 * Story 5.5: TypeORM-сущность инвентаря КУ. Append-on-label, status
 * меняется на Эпике 6 (выдача) / 7 (возврат) / 8 (списание).
 *
 * Hot-path индексы:
 *   - `(coopname, barcode_value)` unique — поиск сканером при выдаче;
 *   - `(coopname, order_id, status)` — список этикеток per-Order;
 *   - `(coopname, braname, status)` — admin-стол склада КУ (Эпик 9);
 *   - `(coopname, shipment_id)` — журнал маркировки per-партия.
 */
@Entity({ name: 'marketplace_inventory' })
@Index('IDX_marketplace_inventory_barcode_unique', ['coopname', 'barcode_value'], { unique: true })
@Index(['coopname', 'order_id', 'status'])
@Index(['coopname', 'braname', 'status'])
@Index(['coopname', 'shipment_id'])
export class MarketplaceInventoryEntity {
  @PrimaryGeneratedColumn('uuid')
  public id!: string;

  @Column({ type: 'varchar', length: 13 })
  public coopname!: string;

  @Column({ type: 'varchar', length: 64 })
  public barcode_value!: string;

  @Column({ type: 'varchar', length: 16 })
  public barcode_format!: MarketplaceBarcodeFormat;

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

  @Column({ type: 'timestamptz' })
  public labeled_at!: Date;

  @Column({ type: 'varchar', length: 13 })
  public labeled_by_operator_account!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  public created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  public updated_at!: Date;
}
