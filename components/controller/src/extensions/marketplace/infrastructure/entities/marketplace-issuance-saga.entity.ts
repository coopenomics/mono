import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { ISignedDocument } from '@coopenomics/innercoop';
import type {
  MarketplaceIssuanceDecisionMode,
  MarketplaceIssuanceSagaFact,
  MarketplaceIssuanceSagaStage,
  MarketplaceIssuanceSagaTxHashes,
} from '../../domain/entities/marketplace-issuance-saga.types';

/**
 * Сага выдачи имущества (паевая модель, компонент 68). Одна запись на заказ;
 * документы этапов в jsonb — устройство пайщика и оператора берут их отсюда
 * для агрегата и второй подписи.
 *
 * Hot-path индексы: очередь стойки (braname + stage), экран пайщика
 * (member + stage), поиск по заказу (order_hash — уникален среди живых саг).
 */
@Entity({ name: 'marketplace_issuance_saga' })
@Index(['coopname', 'order_hash'])
@Index(['coopname', 'member_account', 'stage'])
@Index(['coopname', 'braname', 'stage'])
export class MarketplaceIssuanceSagaEntity {
  @PrimaryGeneratedColumn('uuid')
  public id!: string;

  @Column({ type: 'varchar', length: 13 })
  public coopname!: string;

  @Column({ type: 'uuid' })
  public order_id!: string;

  @Column({ type: 'varchar', length: 64 })
  public order_hash!: string;

  @Column({ type: 'uuid', nullable: true })
  public proposal_id!: string | null;

  @Column({ type: 'varchar', length: 13 })
  public member_account!: string;

  @Column({ type: 'varchar', length: 13 })
  public operator_account!: string;

  @Column({ type: 'varchar', length: 13 })
  public braname!: string;

  @Column({ type: 'varchar', length: 24 })
  public stage!: MarketplaceIssuanceSagaStage;

  @Column({ type: 'varchar', length: 12, default: 'UNKNOWN' })
  public decision_mode!: MarketplaceIssuanceDecisionMode;

  @Column({ type: 'jsonb' })
  public fact!: MarketplaceIssuanceSagaFact;

  @Column({ type: 'jsonb', nullable: true })
  public statement_document!: ISignedDocument | null;

  @Column({ type: 'jsonb', nullable: true })
  public protocol_document!: ISignedDocument | null;

  @Column({ type: 'jsonb', nullable: true })
  public act1_document!: ISignedDocument | null;

  @Column({ type: 'jsonb', nullable: true })
  public act2_document!: ISignedDocument | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  public act_document_hash!: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  public decision_id!: string | null;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  public tx_hashes!: MarketplaceIssuanceSagaTxHashes;

  @Column({ type: 'text', nullable: true })
  public last_error!: string | null;

  @Column({ type: 'integer', default: 0 })
  public attempts!: number;

  @Column({ type: 'timestamptz', nullable: true })
  public decided_at!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  public closed_at!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  public created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  public updated_at!: Date;
}
