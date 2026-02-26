import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('cooplace_marketplace_settings')
export class MarketplaceSettingsTypeormEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  @Index()
  coopname!: string;

  @Column({ default: 'both' })
  lead_request_policy!: string;

  @Column({ default: 'all_members' })
  publish_access_policy!: string;

  @Column({ type: 'simple-array', default: '' })
  publish_whitelist!: string[];

  @Column({ type: 'boolean', default: true })
  moderation_required!: boolean;

  @Column({ type: 'boolean', default: true })
  cycles_enabled!: boolean;

  @Column({ type: 'int', default: 30 })
  max_cycle_days!: number;

  @Column({ type: 'boolean', default: true })
  external_delivery_enabled!: boolean;

  @Column({ type: 'boolean', default: true })
  internal_delivery_enabled!: boolean;

  @Column({ type: 'simple-array', default: '' })
  allowed_category_ids!: string[];

  @Column({ nullable: true })
  min_unit_cost?: string;

  @Column({ nullable: true })
  max_unit_cost?: string;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
