import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('cooplace_product_cards')
export class ProductCardTypeormEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  @Index()
  coopname!: string;

  @Column()
  @Index()
  username!: string;

  @Column({ default: 'offer' })
  type!: string;

  @Column({ default: 'draft' })
  @Index()
  status!: string;

  @Column({ nullable: true })
  category_id?: string;

  @Column()
  title!: string;

  @Column({ type: 'text', default: '' })
  description!: string;

  @Column({ type: 'simple-array', default: '' })
  images!: string[];

  @Column()
  unit_cost!: string;

  @Column({ type: 'int' })
  units!: number;

  @Column({ default: 'internal' })
  delivery_type!: string;

  @Column({ default: 'share' })
  contribution_type!: string;

  @Column({ type: 'int', default: 0 })
  product_lifecycle_secs!: number;

  @Column({ type: 'int', default: 0 })
  warranty_period_secs!: number;

  @Column({ default: '0' })
  membership_fee_amount!: string;

  @Column({ default: '0' })
  cancellation_fee_amount!: string;

  @Column({ type: 'int', default: 0 })
  min_units!: number;

  @Column({ nullable: true })
  braname?: string;

  @Column({ type: 'jsonb', nullable: true })
  meta?: Record<string, any>;

  @Column({ type: 'timestamptz', nullable: true })
  cycle_deadline?: Date;

  @Column({ type: 'int', default: 0 })
  cycle_collected_units!: number;

  @Column({ type: 'int', default: 1 })
  cycle_number!: number;

  @Column({ type: 'boolean', default: true })
  cycle_active!: boolean;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
