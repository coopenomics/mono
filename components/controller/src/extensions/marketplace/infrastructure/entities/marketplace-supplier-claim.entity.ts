import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { ISignedDocument } from '@coopenomics/innercoop';
import type { MarketplaceReturnClaimPhoto } from '../../domain/entities/marketplace-return-claim.types';
import type { MarketplaceSupplierClaimStatus } from '../../domain/entities/marketplace-supplier-claim.types';

/**
 * Компонент 68 / 99D-13: гарантийная претензия поставщику — зеркало on-chain
 * `marketplace::claims`. Одна претензия на рекламацию (`claim_hash` unique).
 *
 * Hot-path индексы:
 *   - `(coopname, claim_hash)` unique — сверка с цепью и слушатели ответов;
 *   - `(coopname, supplier_account, status)` — стол поставщика «Гарантийные возвраты»;
 */
@Entity({ name: 'marketplace_supplier_claim' })
@Index('IDX_marketplace_supplier_claim_hash_unique', ['coopname', 'claim_hash'], { unique: true })
@Index(['coopname', 'supplier_account', 'status'])
export class MarketplaceSupplierClaimEntity {
  @PrimaryGeneratedColumn('uuid')
  public id!: string;

  @Column({ type: 'varchar', length: 13 })
  public coopname!: string;

  @Column({ type: 'varchar', length: 64 })
  public claim_hash!: string;

  @Column({ type: 'uuid' })
  public return_claim_id!: string;

  @Column({ type: 'uuid' })
  public order_id!: string;

  @Column({ type: 'varchar', length: 64 })
  public order_hash!: string;

  @Column({ type: 'varchar', length: 13 })
  public supplier_account!: string;

  @Column({ type: 'varchar', length: 13 })
  public orderer_account!: string;

  @Column({ type: 'varchar', length: 13 })
  public delivery_braname!: string;

  @Column({ type: 'integer' })
  public actual_quantity!: number;

  @Column({ type: 'numeric', precision: 24, scale: 4 })
  public amount!: string;

  @Column({ type: 'text' })
  public reason_text!: string;

  @Column({ type: 'text', default: '' })
  public inspection_result!: string;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  public photos!: MarketplaceReturnClaimPhoto[];

  @Column({ type: 'jsonb', nullable: true })
  public reclamation!: ISignedDocument | null;

  @Column({ type: 'varchar', length: 16 })
  public status!: MarketplaceSupplierClaimStatus;

  @Column({ type: 'timestamptz' })
  public issued_at!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  public decided_at!: Date | null;

  @Column({ type: 'varchar', length: 128, default: '' })
  public issue_tx_hash!: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  public decide_tx_hash!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  public created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  public updated_at!: Date;
}
