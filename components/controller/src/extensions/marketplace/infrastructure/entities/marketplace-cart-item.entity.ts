import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Эпик 16: позиция корзины (оффер × количество). Уникальный индекс
 * (cart_id, offer_id) обеспечивает слияние одинаковых позиций — повторное
 * добавление того же оффера доливает количество, а не плодит строки.
 * Off-chain, DDL через `synchronize`.
 */
@Entity({ name: 'marketplace_cart_item' })
@Index('IDX_marketplace_cart_item_unique', ['cart_id', 'offer_id'], { unique: true })
export class MarketplaceCartItemEntity {
  @PrimaryGeneratedColumn('uuid')
  public id!: string;

  @Column({ type: 'uuid' })
  public cart_id!: string;

  @Column({ type: 'varchar', length: 13 })
  public coopname!: string;

  @Column({ type: 'uuid' })
  public offer_id!: string;

  @Column({ type: 'integer' })
  public quantity!: number;

  @CreateDateColumn({ type: 'timestamptz' })
  public created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  public updated_at!: Date;
}
