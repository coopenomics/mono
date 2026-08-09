import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Story 3.3: журнал решений модерации Offer'ов. Append-only.
 */
@Entity({ name: 'marketplace_moderation_log' })
@Index(['offer_id', 'created_at'])
@Index(['by_account'])
export class MarketplaceModerationLogEntity {
  @PrimaryGeneratedColumn('uuid')
  public id!: string;

  @Column({ type: 'uuid' })
  public offer_id!: string;

  @Column({ type: 'varchar', length: 16 })
  public action!: 'approve' | 'reject' | 'set_warranty';

  @Column({ type: 'varchar', length: 13 })
  public by_account!: string;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  public reason!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  public created_at!: Date;
}
