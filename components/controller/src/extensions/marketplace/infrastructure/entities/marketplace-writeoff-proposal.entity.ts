import type {
  MarketplaceWriteoffProposalDecisionEntry,
  MarketplaceWriteoffProposalItem,
  MarketplaceWriteoffProposalStatus,
  MarketplaceWriteoffProposalTrigger,
} from '../../domain/entities/marketplace-writeoff-proposal.types';

/**
 * Story 8.1 (Эпик 8): TypeORM-сущность проекта решения совета о списании
 * скоропорта. Связка с on-chain wroffprops — по `proposal_hash` (заполняется
 * при переводе DRAFT → ON_AGENDA). Связка с soviet.decisions — по
 * `decision_id`.
 *
 * Партиционно-уникальный индекс по DRAFT-статусу на (coopname) запрещает
 * одновременно держать два черновика; аналогично для активного состояния
 * в совете — серия (ON_AGENDA / AUTHORIZED / EXECUTING) ограничена одним
 * проектом per кооператива (защита от параллельного крон+manual).
 */
export class MarketplaceWriteoffProposalEntity {
  public id!: string;

  public coopname!: string;

  public trigger!: MarketplaceWriteoffProposalTrigger;

  // length 32: самый длинный статус — PENDING_CONFIRMATION (20 символов). При
  // varchar(16) UPDATE статуса в markAuthorized падал «value too long for type
  // character varying(16)», проект навсегда застревал в ON_AGENDA (решение
  // совета не отлавливалось). synchronize:true расширит колонку при старте.
  public status!: MarketplaceWriteoffProposalStatus;

  public cycle_started_at!: Date;

  /** Заполняется при `submitToCouncil`; до этого — пустая строка. */
  public proposal_hash!: string;

  public decision_id!: string | null;

  public proposed_by_account!: string | null;

  public decided_by_account!: string | null;

  public items!: MarketplaceWriteoffProposalItem[];

  public total_amount!: string;

  public protocol_doc!: unknown | null;

  public statement_doc!: unknown | null;

  public reject_reason!: string | null;

  public decision_log!: MarketplaceWriteoffProposalDecisionEntry[];

  public submitted_at!: Date | null;

  public authorized_at!: Date | null;

  public executed_at!: Date | null;

  public rejected_at!: Date | null;

  public created_at!: Date;

  public updated_at!: Date;
}
