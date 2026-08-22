import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { MarketplaceOutgoingPaymentRequestStatus } from '../../domain/entities/marketplace-outgoing-payment-request.types';

/**
 * Story 5.6 / 5.7 + 598-16 (L12): per-Order projection одного outcome'а
 * gateway::outcomes для marketplace UI поставщика. Жизненный цикл —
 * слушатели blockchain action delta (payout / payconfirm / paydecline).
 *
 * Hot-path индексы:
 *   - `(coopname, order_hash)` unique — один Order = одна запись;
 *   - `(coopname, apl_reception_id)` — N записей на одну АПП группы;
 *   - `(coopname, payee_account, status)` — лента истории выплат поставщику.
 */
@Entity({ name: 'marketplace_outgoing_payment_request' })
@Index(
  'IDX_marketplace_outgoing_payment_request_order_unique',
  ['coopname', 'order_hash'],
  { unique: true }
)
@Index(['coopname', 'apl_reception_id'])
@Index(['coopname', 'payee_account', 'status'])
export class MarketplaceOutgoingPaymentRequestEntity {
  @PrimaryGeneratedColumn('uuid')
  public id!: string;

  @Column({ type: 'varchar', length: 13 })
  public coopname!: string;

  @Column({ type: 'varchar', length: 64 })
  public order_hash!: string;

  @Column({ type: 'uuid' })
  public order_id!: string;

  @Column({ type: 'uuid' })
  public apl_reception_id!: string;

  @Column({ type: 'varchar', length: 13 })
  public payee_account!: string;

  @Column({ type: 'numeric', precision: 24, scale: 4 })
  public amount!: string;

  @Column({ type: 'varchar', length: 16 })
  public symbol!: string;

  @Column({ type: 'varchar', length: 500 })
  public purpose!: string;

  /** Маскированная подпись реквизитов получателя, например «Сбербанк •1234». */
  @Column({ type: 'varchar', length: 200, nullable: true })
  public payout_destination!: string | null;

  @Column({ type: 'varchar', length: 32 })
  public status!: MarketplaceOutgoingPaymentRequestStatus;

  @Column({ type: 'timestamptz', nullable: true })
  public completed_at!: Date | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  public decline_reason!: string | null;

  @Column({ type: 'uuid', nullable: true })
  public core_payment_id!: string | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  public payout_tx_hash!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  public created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  public updated_at!: Date;
}
