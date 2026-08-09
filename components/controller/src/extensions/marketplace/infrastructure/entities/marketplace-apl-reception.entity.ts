import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type {
  MarketplaceAplReceptionExpeditorData,
  MarketplaceAplReceptionFactQuantityEntry,
  MarketplaceAplReceptionStatus,
  MarketplaceAplReceptionVariant,
} from '../../domain/entities/marketplace-apl-reception.types';
import type { ISignedDocumentDomainInterface } from '~/domain/document/interfaces/signed-document-domain.interface';

/**
 * Story 5.3 / 5.4: TypeORM-сущность АПП приёмки. Один Shipment имеет ровно
 * одну активную АПП (CANCELLED не блокирует повторную приёмку той же партии).
 *
 * Hot-path индексы:
 *   - `(coopname, shipment_id)` partial-unique WHERE status <> CANCELLED;
 *   - `(coopname, braname, status)` — operator-стол текущих АПП по КУ;
 *   - `(coopname, offerer_account, status)` — offerer-стол для асинхронной
 *     подписи (Вариант Б);
 *   - `(coopname, ttn_number)` partial-unique — Story 5.4 поиск по ТТН,
 *     тоже без CANCELLED (повторная приёмка той же ТТН после отката).
 */
@Entity({ name: 'marketplace_apl_reception' })
@Index('IDX_marketplace_apl_reception_shipment_unique', ['coopname', 'shipment_id'], {
  unique: true,
  where: "status <> 'CANCELLED'",
})
@Index('IDX_marketplace_apl_reception_ttn_unique', ['coopname', 'ttn_number'], {
  unique: true,
  where: "ttn_number IS NOT NULL AND status <> 'CANCELLED'",
})
@Index(['coopname', 'braname', 'status'])
@Index(['coopname', 'offerer_account', 'status'])
export class MarketplaceAplReceptionEntity {
  @PrimaryGeneratedColumn('uuid')
  public id!: string;

  @Column({ type: 'varchar', length: 13 })
  public coopname!: string;

  @Column({ type: 'uuid' })
  public shipment_id!: string;

  @Column({ type: 'uuid' })
  public cycle_id!: string;

  @Column({ type: 'varchar', length: 13 })
  public braname!: string;

  @Column({ type: 'varchar', length: 13 })
  public offerer_account!: string;

  @Column({ type: 'varchar', length: 1 })
  public variant!: MarketplaceAplReceptionVariant;

  @Column({ type: 'varchar', length: 48 })
  public status!: MarketplaceAplReceptionStatus;

  @Column({ type: 'jsonb' })
  public fact_quantity_per_order!: MarketplaceAplReceptionFactQuantityEntry[];

  // length=64 — копируется из shipment.ttn_number (см. marketplace-shipment.entity).
  @Column({ type: 'varchar', length: 64, nullable: true })
  public ttn_number!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  public expeditor_data!: MarketplaceAplReceptionExpeditorData | null;

  @Column({ type: 'varchar', length: 13 })
  public created_by_operator_account!: string;

  @Column({ type: 'timestamptz', nullable: true })
  public supplier_signed_at!: Date | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  public supplier_signsupp_tx_hash!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  public supplier_signed_documents!: ISignedDocumentDomainInterface[] | null;

  @Column({ type: 'timestamptz', nullable: true })
  public chairman_signed_at!: Date | null;

  @Column({ type: 'varchar', length: 13, nullable: true })
  public chairman_account!: string | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  public chairman_signchair_tx_hash!: string | null;

  @Column({ type: 'numeric', precision: 24, scale: 4 })
  public total_amount!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  public created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  public updated_at!: Date;
}
