import type { MarketplaceReturnClaimDomainEntity } from '../entities/marketplace-return-claim.entity';
import type {
  MarketplaceReturnClaimDecisionLogEntry,
  MarketplaceReturnClaimDefectCategory,
  MarketplaceReturnClaimExpectedResolution,
  MarketplaceReturnClaimLedgerSnapshot,
  MarketplaceReturnClaimOnSiteInspection,
  MarketplaceReturnClaimPhoto,
  MarketplaceReturnClaimStatus,
} from '../entities/marketplace-return-claim.types';
import type { ISignedDocument } from '@coopenomics/innercoop';

export const MARKETPLACE_RETURN_CLAIM_REPOSITORY = Symbol('MARKETPLACE_RETURN_CLAIM_REPOSITORY');

export interface MarketplaceReturnClaimCreateInput {
  id: string;
  coopname: string;
  request_hash: string;
  order_id: string;
  order_hash: string;
  orderer_account: string;
  delivery_braname: string;
  supplier_account: string;
  reason_text: string;
  defect_category: MarketplaceReturnClaimDefectCategory | null;
  expected_resolution: MarketplaceReturnClaimExpectedResolution;
  actual_quantity: number;
  fact_cost: string;
  /** Возвращаемая доля членского взноса — вместе с fact_cost даёт полную сумму возврата. */
  fee_refund: string;
  photos: MarketplaceReturnClaimPhoto[];
  /** Подписанное пайщиком заявление (1104) — для последующей со-подписи председателем. */
  statement: ISignedDocument | null;
  submretrn_tx_hash: string;
  status: MarketplaceReturnClaimStatus;
}

export interface MarketplaceReturnClaimApplyDecisionInput {
  status: MarketplaceReturnClaimStatus;
  decision_entry: MarketplaceReturnClaimDecisionLogEntry;
  on_site_inspection?: MarketplaceReturnClaimOnSiteInspection;
  ledger_snapshot?: MarketplaceReturnClaimLedgerSnapshot;
}

export interface MarketplaceReturnClaimDomainRepository {
  create(input: MarketplaceReturnClaimCreateInput): Promise<MarketplaceReturnClaimDomainEntity>;

  findById(id: string): Promise<MarketplaceReturnClaimDomainEntity | null>;
  findByRequestHash(
    coopname: string,
    request_hash: string
  ): Promise<MarketplaceReturnClaimDomainEntity | null>;
  findActiveByOrderId(
    coopname: string,
    order_id: string
  ): Promise<MarketplaceReturnClaimDomainEntity | null>;

  /**
   * Заявления конкретного пайщика-заказчика, сортировка по created_at desc.
   */
  listByOrderer(
    coopname: string,
    orderer_account: string,
    status?: MarketplaceReturnClaimStatus | MarketplaceReturnClaimStatus[]
  ): Promise<MarketplaceReturnClaimDomainEntity[]>;

  /**
   * Заявления, отображаемые в operator-столе на КУ доставки исходного
   * заказа. Если `status` не передан — возвращаются ВСЕ заявления
   * (operator-стол показывает три секции: pending, approved, archive);
   * при `status` запрашивается явная подвыборка.
   */
  listByDeliveryBraname(
    coopname: string,
    delivery_braname: string,
    status?: MarketplaceReturnClaimStatus | MarketplaceReturnClaimStatus[]
  ): Promise<MarketplaceReturnClaimDomainEntity[]>;

  /**
   * Применяет переход состояния заявления — журналирует решение в
   * `decision_log` (append-only) и опционально записывает результаты
   * очного осмотра / снапшот compensating-forward.
   */
  applyDecision(
    id: string,
    input: MarketplaceReturnClaimApplyDecisionInput
  ): Promise<MarketplaceReturnClaimDomainEntity>;
}
