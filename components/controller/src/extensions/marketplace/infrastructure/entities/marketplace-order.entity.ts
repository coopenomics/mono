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
  MarketplaceOrderIssuanceFactSnapshot,
  MarketplaceOrderStatus,
} from '../../domain/entities/marketplace-order.types';
import {
  MarketplaceUnitsOfMeasure,
  type MarketplaceUnitOfMeasure,
} from '../../domain/entities/marketplace-offer.types';
import { numericQuantityTransformer } from './numeric-quantity.transformer';
import type { ISignedDocumentDomainInterface } from '~/domain/document/interfaces/signed-document-domain.interface';

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
@Index(['coopname', 'shipment_id'])
@Index(['coopname', 'orderer_account', 'checkout_id'])
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

  // Дробное количество (Эпик 17): numeric в базовой единице; transformer
  // возвращает number. Точность 3 — граммы/миллилитры (KG/LTR); PCS — целое.
  @Column({ type: 'numeric', precision: 18, scale: 3, transformer: numericQuantityTransformer })
  public quantity!: number;

  // Единица измерения заказа, денормализованная из Offer'а при создании (как и
  // price_per_unit): нужна для сборки on-chain asset-количества (символ KG/LTR/
  // PCS) на выдаче/приёмке/возврате и для форматирования в актах/UI.
  @Column({ type: 'varchar', length: 16, default: MarketplaceUnitsOfMeasure.PIECE })
  public unit_of_measure!: MarketplaceUnitOfMeasure;

  // numeric → string в TypeORM; PR #382 паттерн (см. marketplace_offer)
  @Column({ type: 'numeric', precision: 18, scale: 4 })
  public price_per_unit!: string;

  @Column({ type: 'numeric', precision: 24, scale: 4 })
  public total_cost!: string;

  /**
   * Backend-only Story 4.2 cycle aggregation key (FK на
   * `marketplace_consolidated_request.id`). На Story 4.1 — всегда null.
   */
  @Column({ type: 'uuid', nullable: true })
  public cycle_id!: string | null;

  /**
   * Грань «заказ заказчика» (Эпик 16): общий идентификатор всех строк
   * одного оформления корзины на один КУ. Штампуется при checkout'е; до
   * перехода на корзину (legacy покарточный заказ) — null. Один checkout_id
   * = один `delivery_braname` (инвариант «один заказ — один КУ» enforced
   * на уровне сервиса оформления).
   */
  @Column({ type: 'uuid', nullable: true })
  public checkout_id!: string | null;

  /**
   * Backend-only: партия (`marketplace_shipment.id`), в которую заказ включён
   * при формировании. null = акцептован, но в партию не вошёл. Связь позволяет
   * нескольким частичным партиям сосуществовать на одном (cycle, КУ): приёмка
   * резолвит состав партии по `shipment_id`, а не по (cycle, braname).
   */
  @Column({ type: 'uuid', nullable: true })
  public shipment_id!: string | null;

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
   * Снапшот ledger2 createorder-операции: tx_hash, block_num, locked_amount.
   * Используется для отображения свежего движения резерва в `WalletTimeline`
   * (UX-DR8) сразу после успеха.
   */
  @Column({ type: 'jsonb', nullable: true })
  public create_tx!: MarketplaceOrderCreateTxSnapshot | null;

  // ── Story 6.1 / FR21 — открытие выдачи (signiss1) ──────────────────────

  /**
   * ПВЗ, на котором имущество фактически лежит к моменту выдачи. На
   * `signiss1` приравнивается `delivery_braname`; промежуточные перемещения
   * по заготовочным КУ контрактом не подписываются.
   */
  @Column({ type: 'varchar', length: 13, nullable: true })
  public current_warehouse_braname!: string | null;

  /** Снапшот фактической выдачи после `signiss2` (factual quantity, fact_cost, diff_state). */
  @Column({ type: 'jsonb', nullable: true })
  public issuance_fact!: MarketplaceOrderIssuanceFactSnapshot | null;

  @Column({ type: 'timestamptz', nullable: true })
  public chairman_signed_at!: Date | null;

  @Column({ type: 'varchar', length: 13, nullable: true })
  public chairman_account!: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  public signiss1_tx_hash!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  public issue_act_signiss1_document!: ISignedDocumentDomainInterface | null;

  // ── Story 6.3 / FR24 — финальная подпись заказчика (signiss2) ──────────

  @Column({ type: 'timestamptz', nullable: true })
  public orderer_signed_at!: Date | null;

  @Column({ type: 'varchar', length: 13, nullable: true })
  public delivery_signer_account!: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  public signiss2_tx_hash!: string | null;

  // ── On-chain mirror (поля от syncer'а через `marketplace::orders` row) ──

  /** uint64 id из on-chain row (как string из pg numeric). */
  @Column({ type: 'varchar', length: 32, nullable: true })
  public on_chain_id!: string | null;

  @Column({ type: 'bigint', nullable: true })
  public on_chain_block_num!: number | null;

  @Column({ type: 'boolean', default: false })
  public on_chain_present!: boolean;

  /**
   * Членский взнос, включённый в стоимость заказа (requirement b6). Контракт
   * сам считает и пишет его в `order` row при `createorder` — это on-chain
   * mirror, не backend-вычисление (см. domain MarketplaceOrderBlockchainData).
   * Null до первой sync-дельты и у заказов, созданных до появления поля.
   */
  @Column({ type: 'numeric', precision: 24, scale: 4, nullable: true })
  public membership_fee!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  public created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  public updated_at!: Date;
}
