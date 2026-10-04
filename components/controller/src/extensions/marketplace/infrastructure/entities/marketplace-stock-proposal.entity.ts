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
export class MarketplaceStockProposalEntity {
  public id!: string;

  public coopname!: string;

  public braname!: string;

  public member_account!: string;

  public operator_account!: string;

  // Строки предложения: jsonb-массив { offer_id, quantity, unit_price, product_name }.
  public items!: MarketplaceStockProposalItem[];

  public status!: MarketplaceStockProposalStatus;

  // Заказы из остатка, созданные на акцепте (по одному на строку).
  public created_order_ids!: string[];

  public resolved_at!: Date | null;

  public created_at!: Date;

  public updated_at!: Date;
}
