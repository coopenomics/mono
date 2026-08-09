import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import type {
  MarketplaceSupplyValidationOutcome,
  MarketplaceSupplyValidationReason,
} from '../../domain/entities/marketplace-supply-validation-log.types';

/**
 * Story 5.2: журнал валидаций состава поставки. Append-only для аудита.
 */
@Entity({ name: 'marketplace_supply_validation_log' })
@Index(['coopname', 'cycle_id', 'created_at'])
@Index(['coopname', 'offerer_account', 'outcome'])
export class MarketplaceSupplyValidationLogEntity {
  @PrimaryGeneratedColumn('uuid')
  public id!: string;

  @Column({ type: 'varchar', length: 13 })
  public coopname!: string;

  @Column({ type: 'uuid' })
  public cycle_id!: string;

  @Column({ type: 'varchar', length: 13 })
  public offerer_account!: string;

  @Column({ type: 'varchar', length: 16 })
  public outcome!: MarketplaceSupplyValidationOutcome;

  @Column({ type: 'varchar', length: 500, nullable: true })
  public reason!: string | null;

  @Column({ type: 'varchar', length: 48, nullable: true })
  public reason_code!: MarketplaceSupplyValidationReason | null;

  @Column({ type: 'jsonb' })
  public attempted_groups!: unknown;

  @CreateDateColumn({ type: 'timestamptz' })
  public created_at!: Date;
}
