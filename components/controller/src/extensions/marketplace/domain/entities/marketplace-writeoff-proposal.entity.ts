import type {
  MarketplaceWriteoffProposalDecisionEntry,
  MarketplaceWriteoffProposalItem,
  MarketplaceWriteoffProposalProps,
  MarketplaceWriteoffProposalStatus,
  MarketplaceWriteoffProposalTrigger,
} from './marketplace-writeoff-proposal.types';
import { MarketplaceWriteoffProposalStatuses } from './marketplace-writeoff-proposal.types';

/**
 * Story 8.1 (Эпик 8): доменная сущность проекта решения совета о списании
 * скоропорта. Связка с on-chain `wroffprops` идёт по `proposal_hash`;
 * связка с `soviet.decisions` — по тому же hash и опциональному
 * `decision_id`.
 */
export class MarketplaceWriteoffProposalDomainEntity {
  public readonly id: string;
  public readonly coopname: string;
  public readonly trigger: MarketplaceWriteoffProposalTrigger;
  public status: MarketplaceWriteoffProposalStatus;

  public readonly cycle_started_at: Date;
  public readonly proposal_hash: string;
  public decision_id: number | null;

  public proposed_by_account: string | null;
  public decided_by_account: string | null;

  public items: MarketplaceWriteoffProposalItem[];
  public total_amount: string;

  public protocol_doc: unknown | null;
  public statement_doc: unknown | null;
  public reject_reason: string | null;
  public decision_log: MarketplaceWriteoffProposalDecisionEntry[];

  public submitted_at: Date | null;
  public authorized_at: Date | null;
  public executed_at: Date | null;
  public rejected_at: Date | null;

  public readonly created_at: Date;
  public updated_at: Date;

  constructor(props: MarketplaceWriteoffProposalProps) {
    this.id = props.id;
    this.coopname = props.coopname;
    this.trigger = props.trigger;
    this.status = props.status;
    this.cycle_started_at = props.cycle_started_at;
    this.proposal_hash = props.proposal_hash;
    this.decision_id = props.decision_id;
    this.proposed_by_account = props.proposed_by_account;
    this.decided_by_account = props.decided_by_account;
    this.items = props.items;
    this.total_amount = props.total_amount;
    this.protocol_doc = props.protocol_doc;
    this.statement_doc = props.statement_doc;
    this.reject_reason = props.reject_reason;
    this.decision_log = props.decision_log;
    this.submitted_at = props.submitted_at;
    this.authorized_at = props.authorized_at;
    this.executed_at = props.executed_at;
    this.rejected_at = props.rejected_at;
    this.created_at = props.created_at;
    this.updated_at = props.updated_at;
  }

  public get is_draft(): boolean {
    return this.status === MarketplaceWriteoffProposalStatuses.DRAFT;
  }
  public get is_on_agenda(): boolean {
    return this.status === MarketplaceWriteoffProposalStatuses.ON_AGENDA;
  }
  public get is_authorized(): boolean {
    return this.status === MarketplaceWriteoffProposalStatuses.AUTHORIZED;
  }
  public get is_pending_confirmation(): boolean {
    return this.status === MarketplaceWriteoffProposalStatuses.PENDING_CONFIRMATION;
  }
  public get is_executing(): boolean {
    return this.status === MarketplaceWriteoffProposalStatuses.EXECUTING;
  }
  public get is_executed(): boolean {
    return this.status === MarketplaceWriteoffProposalStatuses.EXECUTED;
  }
  public get is_rejected(): boolean {
    return this.status === MarketplaceWriteoffProposalStatuses.REJECTED;
  }
  public get is_final(): boolean {
    return this.is_executed || this.is_rejected;
  }
  public get items_executed_count(): number {
    return this.items.filter((it) => it.executed).length;
  }
  public get items_pending_count(): number {
    return this.items.filter((it) => !it.executed).length;
  }
  /** Кооперативные участки, чьи позиции ещё не списаны (ждут подтверждения). */
  public get pending_branames(): string[] {
    return [...new Set(this.items.filter((it) => !it.executed).map((it) => it.braname))];
  }
}
