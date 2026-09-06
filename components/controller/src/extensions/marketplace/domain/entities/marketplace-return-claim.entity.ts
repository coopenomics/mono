import {
  MarketplaceReturnClaimStatuses,
  type MarketplaceReturnClaimDecisionLogEntry,
  type MarketplaceReturnClaimDefectCategory,
  type MarketplaceReturnClaimExpectedResolution,
  type MarketplaceReturnClaimLedgerSnapshot,
  type MarketplaceReturnClaimOnSiteInspection,
  type MarketplaceReturnClaimPhoto,
  type MarketplaceReturnClaimProps,
  type MarketplaceReturnClaimStatus,
} from './marketplace-return-claim.types';
import type { ISignedDocument } from '@coopenomics/innercoop';

/**
 * Эпик 7 + компонент 68: домен заявления на гарантийный возврат. Backend
 * ведёт state machine процесса p.mkt.return, on-chain действия (submretrn,
 * aprretrem, rejretrem, accretrn, rejretrn, handback) и обратные вызовы
 * совета (onmktrtauth / onmktrtdecl) фиксируют переходы и якорятся
 * `request_hash` в таблице `marketplace::return_request`.
 */
export class MarketplaceReturnClaimDomainEntity {
  public readonly id: string;
  public readonly coopname: string;
  public readonly request_hash: string;
  public readonly order_id: string;
  public readonly order_hash: string;
  public readonly orderer_account: string;
  public readonly delivery_braname: string;
  public readonly supplier_account: string;
  public status: MarketplaceReturnClaimStatus;
  public readonly reason_text: string;
  public readonly defect_category: MarketplaceReturnClaimDefectCategory | null;
  public readonly expected_resolution: MarketplaceReturnClaimExpectedResolution;
  public readonly actual_quantity: number;
  public readonly fact_cost: string;
  /** Возвращаемая доля членского взноса — вместе с fact_cost даёт полную сумму возврата пайщику. */
  public readonly fee_refund: string;
  public readonly photos: MarketplaceReturnClaimPhoto[];
  public readonly statement: ISignedDocument | null;
  public council_decision_id: string | null;
  public council_decision_mode: 'ROBOT' | 'MANUAL' | null;
  public council_protocol: ISignedDocument | null;
  public accepted_at: Date | null;
  public readonly submretrn_tx_hash: string;
  public decision_log: MarketplaceReturnClaimDecisionLogEntry[];
  public on_site_inspection: MarketplaceReturnClaimOnSiteInspection | null;
  public ledger_snapshot: MarketplaceReturnClaimLedgerSnapshot | null;
  public readonly created_at: Date;
  public updated_at: Date;

  constructor(props: MarketplaceReturnClaimProps) {
    if (!props.id || !props.coopname || !props.request_hash || !props.order_id) {
      throw new Error('MarketplaceReturnClaimDomainEntity: обязательные поля отсутствуют.');
    }
    this.id = props.id;
    this.coopname = props.coopname;
    this.request_hash = props.request_hash;
    this.order_id = props.order_id;
    this.order_hash = props.order_hash;
    this.orderer_account = props.orderer_account;
    this.delivery_braname = props.delivery_braname;
    this.supplier_account = props.supplier_account;
    this.status = props.status;
    this.reason_text = props.reason_text;
    this.defect_category = props.defect_category;
    this.expected_resolution = props.expected_resolution;
    this.actual_quantity = props.actual_quantity;
    this.fact_cost = props.fact_cost;
    this.fee_refund = props.fee_refund ?? '0';
    this.photos = props.photos;
    this.statement = props.statement;
    this.council_decision_id = props.council_decision_id ?? null;
    this.council_decision_mode = props.council_decision_mode ?? null;
    this.council_protocol = props.council_protocol ?? null;
    this.accepted_at = props.accepted_at ?? null;
    this.submretrn_tx_hash = props.submretrn_tx_hash;
    this.decision_log = props.decision_log;
    this.on_site_inspection = props.on_site_inspection;
    this.ledger_snapshot = props.ledger_snapshot;
    this.created_at = props.created_at;
    this.updated_at = props.updated_at;
  }

  public get awaits_chairman_remote_review(): boolean {
    return this.status === MarketplaceReturnClaimStatuses.PENDING_CHAIRMAN_REVIEW;
  }

  public get awaits_visit(): boolean {
    return this.status === MarketplaceReturnClaimStatuses.APPROVED_FOR_VISIT;
  }

  /** Имущество принято, заявление на повестке совета — пайщик в спокойном режиме ожидания. */
  public get awaits_council(): boolean {
    return this.status === MarketplaceReturnClaimStatuses.PENDING_COUNCIL;
  }

  /** Совет отказал — имущество ждёт пайщика на участке, оператор выдаст обратно. */
  public get awaits_hand_back(): boolean {
    return this.status === MarketplaceReturnClaimStatuses.DECLINED_BY_COUNCIL;
  }

  public get is_finalized(): boolean {
    return (
      this.status === MarketplaceReturnClaimStatuses.ACCEPTED_BY_COUNCIL ||
      this.status === MarketplaceReturnClaimStatuses.HANDED_BACK ||
      this.status === MarketplaceReturnClaimStatuses.REJECTED_AT_VISIT ||
      this.status === MarketplaceReturnClaimStatuses.REJECTED_REMOTELY
    );
  }

  public get is_funds_returned(): boolean {
    return this.status === MarketplaceReturnClaimStatuses.ACCEPTED_BY_COUNCIL;
  }
}
