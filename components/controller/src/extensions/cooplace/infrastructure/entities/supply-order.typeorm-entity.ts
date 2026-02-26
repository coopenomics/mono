import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('cooplace_supply_orders')
export class SupplyOrderTypeormEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  @Index()
  coopname!: string;

  @Column()
  offer_card_id!: string;

  @Column({ nullable: true })
  order_card_id?: string;

  @Column({ nullable: true })
  @Index()
  blockchain_hash?: string;

  @Column({ default: 'pending' })
  @Index()
  status!: string;

  @Column()
  supplier_username!: string;

  @Column()
  customer_username!: string;

  @Column({ default: '' })
  supplier_braname!: string;

  @Column({ default: '' })
  receiver_braname!: string;

  @Column({ type: 'int' })
  units!: number;

  @Column()
  unit_cost!: string;

  @Column()
  total_cost!: string;

  @Column({ default: '0' })
  membership_fee!: string;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
