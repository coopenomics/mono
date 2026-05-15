import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type {
  MarketplaceOrderCreateTxSnapshot,
  MarketplaceOrderCycleType,
  MarketplaceOrderStatus,
} from '../../domain/entities/marketplace-order.types';

/**
 * Story 4.1: TypeORM-сущность Order'а Стола заказов. Зеркало
 * on-chain `marketplace::orders` (canonical Story 11.1) + backend-only
 * поля для cycle-агрегации (Эпик 4) и трассировки create-tx.
 *
 * Hot-path индексы:
 *   - `(coopname, orderer_account, status)` — Story 4.6 «Мои заказы»
 *     (orderer filter + per-status group);
 *   - `(coopname, supplier_account, status)` — offerer-стол Stories 4.5/4.6;
 *   - `(coopname, status, created_at)` — admin/cron-сканер цикла (4.2/4.3);
 *   - `(order_hash)` уникальный — sync-key поиск syncer'а;
 *   - `(offer_id, status)` — counters-инвариант Story 3.4 (sanity-check).
 *
 * DDL создаётся через TypeORM `synchronize:true` (паттерн PR #382 для
 * остальных marketplace_* таблиц).
 */
@Entity({ name: 'marketplace_order' })
@Index('IDX_marketplace_order_order_hash_unique', ['coopname', 'order_hash'], { unique: true })
@Index(['coopname', 'orderer_account', 'status'])
@Index(['coopname', 'supplier_account', 'status'])
@Index(['coopname', 'status', 'created_at'])
@Index(['offer_id', 'status'])
export class MarketplaceOrderEntity {
  @PrimaryGeneratedColumn('uuid')
  public id!: string;

  @Column({ type: 'varchar', length: 13 })
  public coopname!: string;

  /**
   * Sync-key — 64-символьный hex без `0x`, lowercase. Соответствует
   * `marketplace::orders.hash` (checksum256 на цепи).
   */
  @Column({ type: 'varchar', length: 64 })
  public order_hash!: string;

  @Column({ type: 'varchar', length: 13 })
  public orderer_account!: string;

  @Column({ type: 'uuid' })
  public offer_id!: string;

  @Column({ type: 'varchar', length: 64 })
  public offer_hash!: string;

  @Column({ type: 'varchar', length: 13 })
  public supplier_account!: string;

  @Column({ type: 'varchar', length: 13 })
  public delivery_braname!: string;

  @Column({ type: 'integer' })
  public quantity!: number;

  // numeric → string в TypeORM; PR #382 паттерн (см. marketplace_offer)
  @Column({ type: 'numeric', precision: 18, scale: 4 })
  public price_per_unit!: string;

  @Column({ type: 'numeric', precision: 24, scale: 4 })
  public total_cost!: string;

  @Column({ type: 'varchar', length: 32 })
  public cycle_type!: MarketplaceOrderCycleType;

  /**
   * Backend-only Story 4.2 cycle aggregation key (FK на
   * `marketplace_consolidated_request.id`). На Story 4.1 — всегда null.
   */
  @Column({ type: 'uuid', nullable: true })
  public cycle_id!: string | null;

  @Column({ type: 'integer' })
  public warranty_period_secs!: number;

  @Column({ type: 'timestamptz', nullable: true })
  public warranty_until!: Date | null;

  @Column({ type: 'varchar', length: 48 })
  public status!: MarketplaceOrderStatus;

  @Column({ type: 'varchar', length: 500, nullable: true })
  public last_status_reason!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  public blocked_at!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  public accepted_at!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  public received_at!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  public cancelled_at!: Date | null;

  /**
   * Снапшот ledger2 createorder-серии: tx_hash, block_num, did_convert,
   * did_assign, blocked_amount. Используется для отображения свежего
   * BLOCK-движения в `WalletTimeline` (UX-DR8) сразу после успеха.
   */
  @Column({ type: 'jsonb', nullable: true })
  public create_tx!: MarketplaceOrderCreateTxSnapshot | null;

  // ── On-chain mirror (поля от syncer'а через `marketplace::orders` row) ──

  /** uint64 id из on-chain row (как string из pg numeric). */
  @Column({ type: 'varchar', length: 32, nullable: true })
  public on_chain_id!: string | null;

  @Column({ type: 'bigint', nullable: true })
  public on_chain_block_num!: number | null;

  @Column({ type: 'boolean', default: false })
  public on_chain_present!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  public created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  public updated_at!: Date;
}
