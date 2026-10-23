import type {
  MarketplaceReturnClaimDecisionLogEntry,
  MarketplaceReturnClaimDefectCategory,
  MarketplaceReturnClaimExpectedResolution,
  MarketplaceReturnClaimLedgerSnapshot,
  MarketplaceReturnClaimOnSiteInspection,
  MarketplaceReturnClaimPhoto,
  MarketplaceReturnClaimStatus,
} from '../../domain/entities/marketplace-return-claim.types';
import type { ISignedDocument } from '@coopenomics/innercoop';

/**
 * Эпик 7 + компонент 68: TypeORM-сущность заявления на гарантийный возврат.
 * Один Order имеет максимум одно активное заявление (PENDING_CHAIRMAN_REVIEW /
 * APPROVED_FOR_VISIT / PENDING_COUNCIL / DECLINED_BY_COUNCIL); финализированные
 * (ACCEPTED_BY_COUNCIL / HANDED_BACK / REJECTED_REMOTELY / REJECTED_AT_VISIT)
 * хранятся в архиве.
 *
 * Hot-path индексы:
 *   - `(coopname, request_hash)` unique — двусторонняя сверка с on-chain
 *     `marketplace::return_request.hash`;
 *   - `(coopname, delivery_braname, status)` — operator-стол на КУ выдачи;
 *   - `(coopname, orderer_account, status)` — orderer-стол «мои возвраты»;
 *   - `(coopname, order_id)` partial-unique для активного заявления
 *     (чтобы пайщик не создал второе на один Order одновременно).
 */
export class MarketplaceReturnClaimEntity {
  public id!: string;

  public coopname!: string;

  public request_hash!: string;

  public order_id!: string;

  public order_hash!: string;

  public orderer_account!: string;

  public delivery_braname!: string;

  public supplier_account!: string;

  public status!: MarketplaceReturnClaimStatus;

  public reason_text!: string;

  public defect_category!: MarketplaceReturnClaimDefectCategory | null;

  public expected_resolution!: MarketplaceReturnClaimExpectedResolution;

  public actual_quantity!: number;

  public fact_cost!: string;

  /**
   * Возвращаемая доля членского взноса. Гарантийный возврат возвращает пайщику
   * полную уплаченную сумму: стоимость имущества (fact_cost) и уплаченный за
   * него взнос. Значение фиксируется при подаче заявления той же формулой, что
   * и в контракте; у заявлений, поданных до введения возврата взноса, — 0.
   */
  public fee_refund!: string;

  public photos!: MarketplaceReturnClaimPhoto[];

  public statement!: ISignedDocument | null;

  /** Заявление оператора участка в совет об отмене сделки (1116) — после приёма имущества у стойки. */
  public cancel_statement!: ISignedDocument | null;

  public council_decision_id!: string | null;

  public council_decision_mode!: 'ROBOT' | 'MANUAL' | null;

  public council_protocol!: ISignedDocument | null;

  public accepted_at!: Date | null;

  public submretrn_tx_hash!: string;

  public decision_log!: MarketplaceReturnClaimDecisionLogEntry[];

  public on_site_inspection!: MarketplaceReturnClaimOnSiteInspection | null;

  public ledger_snapshot!: MarketplaceReturnClaimLedgerSnapshot | null;

  /**
   * Совет отменил сделку, а общий кошелёк участка был уже распределён:
   * членский взнос ждёт пополнения кошелька (заявка на цепи в `feepend`,
   * задача 99D-15). Крон повторяет `payretfee`; null — взнос не ждёт.
   */
  public fee_refund_pending_at!: Date | null;

  public created_at!: Date;

  public updated_at!: Date;
}
