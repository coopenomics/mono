import type { ISignedDocument } from '@coopenomics/innercoop';
import type { MarketplaceReturnClaimPhoto } from '../../domain/entities/marketplace-return-claim.types';
import type { MarketplaceSupplierClaimStatus } from '../../domain/entities/marketplace-supplier-claim.types';

/**
 * Компонент 68 / 99D-13: гарантийная претензия поставщику — зеркало on-chain
 * `marketplace::claims`. Одна претензия на рекламацию (`claim_hash` unique).
 *
 * Hot-path индексы:
 *   - `(coopname, claim_hash)` unique — сверка с цепью и слушатели ответов;
 *   - `(coopname, supplier_account, status)` — стол поставщика «Гарантийные возвраты»;
 */
export class MarketplaceSupplierClaimEntity {
  public id!: string;

  public coopname!: string;

  public claim_hash!: string;

  public return_claim_id!: string;

  public order_id!: string;

  public order_hash!: string;

  public supplier_account!: string;

  public orderer_account!: string;

  public delivery_braname!: string;

  public actual_quantity!: number;

  public amount!: string;

  public reason_text!: string;

  public inspection_result!: string;

  public photos!: MarketplaceReturnClaimPhoto[];

  public reclamation!: ISignedDocument | null;

  public status!: MarketplaceSupplierClaimStatus;

  public issued_at!: Date;

  public decided_at!: Date | null;

  public issue_tx_hash!: string;

  public decide_tx_hash!: string | null;

  public created_at!: Date;

  public updated_at!: Date;
}
