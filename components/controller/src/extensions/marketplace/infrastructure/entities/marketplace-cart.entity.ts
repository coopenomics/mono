import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Эпик 16: корзина заказчика. Одна на пару (coopname, orderer_account) —
 * гарантируется уникальным индексом. Off-chain, DDL через `synchronize`.
 */
@Entity({ name: 'marketplace_cart' })
@Index('IDX_marketplace_cart_orderer_unique', ['coopname', 'orderer_account'], { unique: true })
export class MarketplaceCartEntity {
  @PrimaryGeneratedColumn('uuid')
  public id!: string;

  @Column({ type: 'varchar', length: 13 })
  public coopname!: string;

  @Column({ type: 'varchar', length: 13 })
  public orderer_account!: string;

  /** Текущий КУ доставки корзины (branch.name); null — пока не выбран. */
  @Column({ type: 'varchar', length: 13, nullable: true })
  public delivery_braname!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  public created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  public updated_at!: Date;
}
