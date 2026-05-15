import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Story 3.2: Offer Стола заказов. Pure db (не on-chain).
 * Поля под Story 3.3/3.4 проставлены сразу — миграция расширения едина.
 *
 * Hot-path индексы для каталога (Story 3.5): `(cooperative_id, status,
 * category_id)` — фильтр-чипы; `(supplier_account, status)` — «мои оферы».
 */
@Entity({ name: 'marketplace_offer' })
@Index(['cooperative_id', 'status', 'category_id'])
@Index(['supplier_account', 'status'])
@Index(['status', 'created_at'])
export class MarketplaceOfferEntity {
  @PrimaryGeneratedColumn('uuid')
  public id!: string;

  @Column({ type: 'varchar', length: 13 })
  public cooperative_id!: string;

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

  // numeric → string в TypeORM (precision deliberately, не плодим float)
  @Column({ type: 'numeric', precision: 18, scale: 4 })
  public price_per_unit!: string;

  @Column({ type: 'varchar', length: 16 })
  public unit_of_measure!: 'piece' | 'kg' | 'liter' | 'pack';

  @Column({ type: 'integer', default: 0 })
  public quantity_available!: number;

  @Column({ type: 'integer', default: 0 })
  public quantity_blocked!: number;

  @Column({ type: 'integer', default: 0 })
  public quantity_consumed!: number;

  @Column({ type: 'boolean', default: false })
  public unlimited_flag!: boolean;

  @Column({ type: 'varchar', length: 32 })
  public cycle_type!: 'time_based' | 'volume_based' | 'open_subscription' | 'individual';

  @Column({ type: 'integer', nullable: true })
  public cycle_days!: number | null;

  @Column({ type: 'integer', nullable: true })
  public target_volume!: number | null;

  @Column({ type: 'integer', nullable: true })
  public max_wait_days!: number | null;

  @Column({ type: 'integer', nullable: true })
  public min_threshold!: number | null;

  @Column({ type: 'integer', default: 0 })
  public warranty_days!: number;

  @Column({ type: 'varchar', length: 32 })
  public status!: 'PENDING_MODERATION' | 'ACTIVE' | 'REJECTED' | 'WITHDRAWN';

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
