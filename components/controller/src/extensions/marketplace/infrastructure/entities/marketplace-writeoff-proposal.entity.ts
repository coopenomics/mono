import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type {
  MarketplaceWriteoffProposalDecisionEntry,
  MarketplaceWriteoffProposalItem,
  MarketplaceWriteoffProposalStatus,
  MarketplaceWriteoffProposalTrigger,
} from '../../domain/entities/marketplace-writeoff-proposal.types';

/**
 * Story 8.1 (Эпик 8): TypeORM-сущность проекта решения совета о списании
 * скоропорта. Связка с on-chain wroffprops — по `proposal_hash` (заполняется
 * при переводе DRAFT → ON_AGENDA). Связка с soviet.decisions — по
 * `decision_id`.
 *
 * Партиционно-уникальный индекс по DRAFT-статусу на (coopname) запрещает
 * одновременно держать два черновика; аналогично для активного состояния
 * в совете — серия (ON_AGENDA / AUTHORIZED / EXECUTING) ограничена одним
 * проектом per кооператива (защита от параллельного крон+manual).
 */
@Entity({ name: 'marketplace_writeoff_proposal' })
@Index(['coopname', 'status'])
@Index('UQ_marketplace_writeoff_proposal_hash', ['coopname', 'proposal_hash'], {
  unique: true,
  where: "proposal_hash <> ''",
})
@Index('UQ_marketplace_writeoff_proposal_draft', ['coopname'], {
  unique: true,
  where: "status = 'DRAFT'",
})
export class MarketplaceWriteoffProposalEntity {
  @PrimaryGeneratedColumn('uuid')
  public id!: string;

  @Column({ type: 'varchar', length: 13 })
  public coopname!: string;

  @Column({ type: 'varchar', length: 16 })
  public trigger!: MarketplaceWriteoffProposalTrigger;

  @Column({ type: 'varchar', length: 16 })
  public status!: MarketplaceWriteoffProposalStatus;

  @Column({ type: 'timestamptz' })
  public cycle_started_at!: Date;

  /** Заполняется при `submitToCouncil`; до этого — пустая строка. */
  @Column({ type: 'varchar', length: 64, default: '' })
  public proposal_hash!: string;

  @Column({ type: 'bigint', nullable: true })
  public decision_id!: string | null;

  @Column({ type: 'varchar', length: 13, nullable: true })
  public proposed_by_account!: string | null;

  @Column({ type: 'varchar', length: 13, nullable: true })
  public decided_by_account!: string | null;

  @Column({ type: 'jsonb' })
  public items!: MarketplaceWriteoffProposalItem[];

  @Column({ type: 'varchar', length: 48 })
  public total_amount!: string;

  @Column({ type: 'jsonb', nullable: true })
  public protocol_doc!: unknown | null;

  @Column({ type: 'jsonb', nullable: true })
  public statement_doc!: unknown | null;

  @Column({ type: 'text', nullable: true })
  public reject_reason!: string | null;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  public decision_log!: MarketplaceWriteoffProposalDecisionEntry[];

  @Column({ type: 'timestamptz', nullable: true })
  public submitted_at!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  public authorized_at!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  public executed_at!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  public rejected_at!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  public created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  public updated_at!: Date;
}
