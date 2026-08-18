import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type {
  MarketplaceReturnClaimDecisionLogEntry,
  MarketplaceReturnClaimDefectCategory,
  MarketplaceReturnClaimExpectedResolution,
  MarketplaceReturnClaimLedgerSnapshot,
  MarketplaceReturnClaimOnSiteInspection,
  MarketplaceReturnClaimPhoto,
  MarketplaceReturnClaimStatus,
} from '../../domain/entities/marketplace-return-claim.types';
import type { ISignedDocument } from '@coopenomics/innercoop';

/**
 * Эпик 7: TypeORM-сущность заявления на гарантийный возврат. Один Order
 * имеет максимум одно активное заявление (PENDING_CHAIRMAN_REVIEW либо
 * APPROVED_FOR_VISIT); финализированные заявления (ACCEPTED_AT_VISIT /
 * REJECTED_REMOTELY / REJECTED_AT_VISIT) хранятся в архиве.
 *
 * Hot-path индексы:
 *   - `(coopname, request_hash)` unique — двусторонняя сверка с on-chain
 *     `marketplace::return_request.hash`;
 *   - `(coopname, delivery_braname, status)` — operator-стол на КУ выдачи;
 *   - `(coopname, orderer_account, status)` — orderer-стол «мои возвраты»;
 *   - `(coopname, order_id)` partial-unique для активного заявления
 *     (чтобы пайщик не создал второе на один Order одновременно).
 */
@Entity({ name: 'marketplace_return_claim' })
@Index('IDX_marketplace_return_claim_request_hash_unique', ['coopname', 'request_hash'], { unique: true })
@Index('IDX_marketplace_return_claim_order_active', ['coopname', 'order_id'], {
  unique: true,
  where: "status IN ('PENDING_CHAIRMAN_REVIEW', 'APPROVED_FOR_VISIT')",
})
@Index(['coopname', 'delivery_braname', 'status'])
@Index(['coopname', 'orderer_account', 'status'])
export class MarketplaceReturnClaimEntity {
  @PrimaryGeneratedColumn('uuid')
  public id!: string;

  @Column({ type: 'varchar', length: 13 })
  public coopname!: string;

  @Column({ type: 'varchar', length: 64 })
  public request_hash!: string;

  @Column({ type: 'uuid' })
  public order_id!: string;

  @Column({ type: 'varchar', length: 64 })
  public order_hash!: string;

  @Column({ type: 'varchar', length: 13 })
  public orderer_account!: string;

  @Column({ type: 'varchar', length: 13 })
  public delivery_braname!: string;

  @Column({ type: 'varchar', length: 13 })
  public supplier_account!: string;

  @Column({ type: 'varchar', length: 48 })
  public status!: MarketplaceReturnClaimStatus;

  @Column({ type: 'text' })
  public reason_text!: string;

  @Column({ type: 'varchar', length: 24, nullable: true })
  public defect_category!: MarketplaceReturnClaimDefectCategory | null;

  @Column({ type: 'varchar', length: 24 })
  public expected_resolution!: MarketplaceReturnClaimExpectedResolution;

  @Column({ type: 'integer' })
  public actual_quantity!: number;

  @Column({ type: 'numeric', precision: 24, scale: 4 })
  public fact_cost!: string;

  /**
   * Возвращаемая доля членского взноса. Гарантийный возврат возвращает пайщику
   * полную уплаченную сумму: стоимость имущества (fact_cost) и уплаченный за
   * него взнос. Значение фиксируется при подаче заявления той же формулой, что
   * и в контракте; у заявлений, поданных до введения возврата взноса, — 0.
   */
  @Column({ type: 'numeric', precision: 24, scale: 4, default: 0 })
  public fee_refund!: string;

  @Column({ type: 'jsonb' })
  public photos!: MarketplaceReturnClaimPhoto[];

  @Column({ type: 'jsonb', nullable: true })
  public statement!: ISignedDocument | null;

  @Column({ type: 'varchar', length: 128 })
  public submretrn_tx_hash!: string;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  public decision_log!: MarketplaceReturnClaimDecisionLogEntry[];

  @Column({ type: 'jsonb', nullable: true })
  public on_site_inspection!: MarketplaceReturnClaimOnSiteInspection | null;

  @Column({ type: 'jsonb', nullable: true })
  public ledger_snapshot!: MarketplaceReturnClaimLedgerSnapshot | null;

  @CreateDateColumn({ type: 'timestamptz' })
  public created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  public updated_at!: Date;
}
