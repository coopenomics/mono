import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type {
  MarketplaceConsolidatedRequestStatus,
} from '../../domain/entities/marketplace-consolidated-request.types';
import type { MarketplaceOrderCycleType } from '../../domain/entities/marketplace-order.types';

/**
 * Story 4.2: TypeORM-сущность консолидированной заявки. Backend-only
 * (L10) — связь с Order'ами через `marketplace_order.cycle_id = id`.
 *
 * Hot-path индексы:
 *   - `(coopname, supplier_account, status)` — offerer-стол «Консолидированные
 *     заявки» (Story 4.5 supplier accept/decline UI);
 *   - `(coopname, offer_id, status)` — pre-aggregator проверка «нет ли
 *     уже активной заявки» (idempotency cron-цикла);
 *   - `(cycle_type, status, expires_at)` — cron-scan активных Pending по
 *     истечению (Story 4.3 expire-handler).
 */
@Entity({ name: 'marketplace_consolidated_request' })
@Index(['coopname', 'supplier_account', 'status'])
@Index(['coopname', 'offer_id', 'status'])
@Index(['cycle_type', 'status', 'expires_at'])
export class MarketplaceConsolidatedRequestEntity {
  @PrimaryGeneratedColumn('uuid')
  public id!: string;

  @Column({ type: 'varchar', length: 13 })
  public coopname!: string;

  @Column({ type: 'uuid' })
  public offer_id!: string;

  @Column({ type: 'varchar', length: 13 })
  public supplier_account!: string;

  @Column({ type: 'varchar', length: 32 })
  public cycle_type!: MarketplaceOrderCycleType;

  @Column({ type: 'integer' })
  public total_quantity!: number;

  @Column({ type: 'numeric', precision: 24, scale: 4 })
  public total_amount!: string;

  @Column({ type: 'varchar', length: 32 })
  public status!: MarketplaceConsolidatedRequestStatus;

  @Column({ type: 'timestamptz' })
  public cycle_started_at!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  public cycle_ended_at!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  public expires_at!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  public accepted_at!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  public declined_at!: Date | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  public decline_reason!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  public triggered_by_supplier_at!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  public created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  public updated_at!: Date;
}
