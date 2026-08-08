import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type {
  MarketplaceStockProposalItem,
  MarketplaceStockProposalStatus,
} from '../../domain/entities/marketplace-stock-proposal.types';

/**
 * Предложение докладки из остатка склада КУ (requirement 76). Pure db —
 * on-chain след появляется только на акцепте (stockorder per строка).
 *
 * Hot-path индексы: входящие предложения пайщика (member + status) и
 * активные предложения стойки оператора (braname + status).
 */
@Entity({ name: 'marketplace_stock_proposal' })
@Index(['coopname', 'member_account', 'status'])
@Index(['coopname', 'braname', 'status'])
export class MarketplaceStockProposalEntity {
  @PrimaryGeneratedColumn('uuid')
  public id!: string;

  @Column({ type: 'varchar', length: 13 })
  public coopname!: string;

  @Column({ type: 'varchar', length: 13 })
  public braname!: string;

  @Column({ type: 'varchar', length: 13 })
  public member_account!: string;

  @Column({ type: 'varchar', length: 13 })
  public operator_account!: string;

  // Строки предложения: jsonb-массив { offer_id, quantity, unit_price, product_name }.
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  public items!: MarketplaceStockProposalItem[];

  @Column({ type: 'varchar', length: 16 })
  public status!: MarketplaceStockProposalStatus;

  // Заказы из остатка, созданные на акцепте (по одному на строку).
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  public created_order_ids!: string[];

  @Column({ type: 'timestamptz', nullable: true })
  public resolved_at!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  public created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  public updated_at!: Date;
}
