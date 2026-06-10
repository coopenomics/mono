import type {
  MarketplaceStockProposalItem,
  MarketplaceStockProposalProps,
  MarketplaceStockProposalStatus,
} from './marketplace-stock-proposal.types';

/**
 * Предложение докладки из остатка склада КУ (requirement 76). Создаётся
 * оператором у стойки выдачи после QR-резолва пайщика (заказ пайщика не
 * обязателен — «просто зашёл»); судьба неподписанной докладки в руках
 * оператора — до акцепта он может отозвать и переформировать.
 */
export class MarketplaceStockProposalDomainEntity {
  public readonly id: string;
  public readonly coopname: string;
  public readonly braname: string;
  public readonly member_account: string;
  public readonly operator_account: string;
  public readonly items: MarketplaceStockProposalItem[];
  public status: MarketplaceStockProposalStatus;
  public readonly created_order_ids: string[];
  public readonly resolved_at: Date | null;
  public readonly created_at: Date;
  public updated_at: Date;

  constructor(props: MarketplaceStockProposalProps) {
    if (props.items.length === 0) {
      throw new Error('MarketplaceStockProposalDomainEntity: предложение не может быть пустым.');
    }
    if (props.items.some((i) => i.quantity <= 0)) {
      throw new Error('MarketplaceStockProposalDomainEntity: количество в строке должно быть положительным.');
    }
    this.id = props.id;
    this.coopname = props.coopname;
    this.braname = props.braname;
    this.member_account = props.member_account;
    this.operator_account = props.operator_account;
    this.items = props.items;
    this.status = props.status;
    this.created_order_ids = props.created_order_ids;
    this.resolved_at = props.resolved_at;
    this.created_at = props.created_at;
    this.updated_at = props.updated_at;
  }

  /** Итоговая сумма предложения (для гарда баланса и показа пайщику). */
  get total_cost(): number {
    return this.items.reduce((sum, i) => sum + i.quantity * Number.parseFloat(i.unit_price), 0);
  }
}
