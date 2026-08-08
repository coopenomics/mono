import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { numericQuantityTransformer } from './numeric-quantity.transformer';

/**
 * Эпик 16: позиция корзины (оффер × количество). Уникальный индекс
 * (cart_id, offer_id, package_id) обеспечивает слияние одинаковых позиций —
 * повторное добавление того же оффера с той же упаковкой доливает количество,
 * а не плодит строки; разные упаковки одного оффера — отдельные строки.
 * Off-chain, DDL через `synchronize`.
 */
@Entity({ name: 'marketplace_cart_item' })
@Index('IDX_marketplace_cart_item_unique', ['cart_id', 'offer_id', 'package_id'], { unique: true })
export class MarketplaceCartItemEntity {
  @PrimaryGeneratedColumn('uuid')
  public id!: string;

  @Column({ type: 'uuid' })
  public cart_id!: string;

  @Column({ type: 'varchar', length: 13 })
  public coopname!: string;

  @Column({ type: 'uuid' })
  public offer_id!: string;

  /**
   * Выбранная упаковка каталога оффера (Эпик 18) при отпуске упаковкой; пустая
   * строка `''` при отпуске по мере (участвует в уникальном индексе, поэтому не
   * NULL — иначе Postgres не сольёт одинаковые by_measure-позиции).
   */
  @Column({ type: 'varchar', length: 36, default: '' })
  public package_id!: string;

  /**
   * Количество (Эпик 17/18): numeric в базовой единице при отпуске по мере
   * (дробное), либо целое число упаковок при отпуске упаковкой. transformer → number.
   */
  @Column({ type: 'numeric', precision: 18, scale: 3, transformer: numericQuantityTransformer })
  public quantity!: number;

  @CreateDateColumn({ type: 'timestamptz' })
  public created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  public updated_at!: Date;
}
