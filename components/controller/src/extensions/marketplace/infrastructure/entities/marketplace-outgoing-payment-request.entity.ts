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
 * Story 5.6 / 5.7: TypeORM-сущность запроса исходящего платежа.
 *
 * Hot-path индексы:
 *   - `(coopname, apl_reception_id)` unique — одна АПП → один запрос платежа;
 *   - `(coopname, payee_account, status)` — стол кассира + история поставщика;
 *   - `(coopname, status, created_at)` — лента «ожидают подтверждения».
 */
@Entity({ name: 'marketplace_outgoing_payment_request' })
@Index(
  'IDX_marketplace_outgoing_payment_request_apl_unique',
  ['coopname', 'apl_reception_id'],
  { unique: true }
)
@Index(['coopname', 'payee_account', 'status'])
@Index(['coopname', 'status', 'created_at'])
export class MarketplaceOutgoingPaymentRequestEntity {
  @PrimaryGeneratedColumn('uuid')
  public id!: string;

  @Column({ type: 'varchar', length: 13 })
  public coopname!: string;

  @Column({ type: 'uuid' })
  public apl_reception_id!: string;

  @Column({ type: 'varchar', length: 13 })
  public payee_account!: string;

  @Column({ type: 'jsonb' })
  public related_order_ids!: string[];

  @Column({ type: 'numeric', precision: 24, scale: 4 })
  public amount!: string;

  @Column({ type: 'varchar', length: 16 })
  public symbol!: string;

  @Column({ type: 'varchar', length: 500 })
  public purpose!: string;

  @Column({ type: 'varchar', length: 32 })
  public status!: MarketplaceOutgoingPaymentRequestStatus;

  @Column({ type: 'timestamptz', nullable: true })
  public confirmed_at!: Date | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  public payment_reference!: string | null;

  @Column({ type: 'varchar', length: 256, nullable: true })
  public bank_statement_ref!: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  public blocked_reason!: string | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  public payout_tx_hash!: string | null;

  /**
   * Story 598-17 / AR35: ID соответствующего платежа в core-реестре
   * (`payments` table). NULL — до момента синхронизации (legacy строки)
   * либо если core-вызов упал; в таком случае marketplace-запись живёт
   * самостоятельно как fallback. Заполняется в
   * `MarketplaceAplReceptionService.createOutgoingPaymentRequest`
   * сразу после успешного `GatewayInteractor.createSystemOutgoingPayment`.
   */
  @Column({ type: 'uuid', nullable: true })
  public core_payment_id!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  public created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  public updated_at!: Date;
}
