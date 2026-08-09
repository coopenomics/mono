import type { PaginationInputDTO } from '~/application/common/dto/pagination.dto';
import type { MarketplaceWriteoffProposalDomainEntity } from '../entities/marketplace-writeoff-proposal.entity';
import type {
  MarketplaceWriteoffProposalDecisionEntry,
  MarketplaceWriteoffProposalItem,
  MarketplaceWriteoffProposalStatus,
  MarketplaceWriteoffProposalTrigger,
} from '../entities/marketplace-writeoff-proposal.types';

export const MARKETPLACE_WRITEOFF_PROPOSAL_REPOSITORY = Symbol(
  'MARKETPLACE_WRITEOFF_PROPOSAL_REPOSITORY'
);

export interface MarketplaceWriteoffProposalCreateInput {
  coopname: string;
  trigger: MarketplaceWriteoffProposalTrigger;
  cycle_started_at: Date;
  proposed_by_account: string | null;
  items: MarketplaceWriteoffProposalItem[];
  total_amount: string;
}

export interface MarketplaceWriteoffProposalListFilter {
  coopname: string;
  statuses?: MarketplaceWriteoffProposalStatus[];
}

export interface MarketplaceWriteoffProposalDomainRepository {
  create(
    input: MarketplaceWriteoffProposalCreateInput
  ): Promise<MarketplaceWriteoffProposalDomainEntity>;

  findById(id: string): Promise<MarketplaceWriteoffProposalDomainEntity | null>;

  findByHash(
    coopname: string,
    proposal_hash: string
  ): Promise<MarketplaceWriteoffProposalDomainEntity | null>;

  /** Один черновик в работе у coopname (DRAFT). */
  findOpenDraft(coopname: string): Promise<MarketplaceWriteoffProposalDomainEntity | null>;

  /**
   * Активный (не финальный) проект, отправленный в совет: статусы
   * ON_AGENDA, AUTHORIZED или EXECUTING. Гарантирует невозможность вынести
   * второй проект пока предыдущий не закрыт.
   */
  findOpenInCouncil(
    coopname: string
  ): Promise<MarketplaceWriteoffProposalDomainEntity | null>;

  /**
   * inventory_id позиций, занятых в незавершённых проектах списания (черновик,
   * в совете, одобрено, ожидает подтверждения, в исполнении). Используется,
   * чтобы не показывать одни и те же позиции кандидатами в новый проект.
   */
  findActiveLockedInventoryIds(coopname: string): Promise<string[]>;

  list(
    filter: MarketplaceWriteoffProposalListFilter,
    pagination?: PaginationInputDTO
  ): Promise<{ items: MarketplaceWriteoffProposalDomainEntity[]; total: number }>;

  updateDraftItems(
    id: string,
    items: MarketplaceWriteoffProposalItem[],
    total_amount: string,
    log: MarketplaceWriteoffProposalDecisionEntry
  ): Promise<MarketplaceWriteoffProposalDomainEntity>;

  submitToCouncil(
    id: string,
    patch: {
      proposal_hash: string;
      statement_doc: unknown;
      decision_id: number | null;
      submitted_at: Date;
      proposed_by_account: string;
      log: MarketplaceWriteoffProposalDecisionEntry;
    }
  ): Promise<MarketplaceWriteoffProposalDomainEntity>;

  markAuthorized(
    id: string,
    patch: {
      protocol_doc: unknown;
      authorized_at: Date;
      decided_by_account: string | null;
      log: MarketplaceWriteoffProposalDecisionEntry;
    }
  ): Promise<MarketplaceWriteoffProposalDomainEntity>;

  markExecuting(
    id: string,
    log: MarketplaceWriteoffProposalDecisionEntry
  ): Promise<MarketplaceWriteoffProposalDomainEntity>;

  markItemExecuted(
    id: string,
    item_index: number,
    log: MarketplaceWriteoffProposalDecisionEntry
  ): Promise<MarketplaceWriteoffProposalDomainEntity>;

  markFullyExecuted(
    id: string,
    log: MarketplaceWriteoffProposalDecisionEntry
  ): Promise<MarketplaceWriteoffProposalDomainEntity>;

  markRejected(
    id: string,
    patch: {
      reject_reason: string;
      rejected_at: Date;
      decided_by_account: string | null;
      log: MarketplaceWriteoffProposalDecisionEntry;
    }
  ): Promise<MarketplaceWriteoffProposalDomainEntity>;

  cancelDraft(id: string): Promise<void>;
}
