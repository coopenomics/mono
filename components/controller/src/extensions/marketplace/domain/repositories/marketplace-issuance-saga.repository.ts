import type { MarketplaceIssuanceSagaDomainEntity } from '../entities/marketplace-issuance-saga.entity';
import type {
  MarketplaceIssuanceDecisionMode,
  MarketplaceIssuanceSagaFact,
  MarketplaceIssuanceSagaStage,
  MarketplaceIssuanceSagaTxHashes,
} from '../entities/marketplace-issuance-saga.types';
import type { ISignedDocument } from '@coopenomics/innercoop';

export const MARKETPLACE_ISSUANCE_SAGA_REPOSITORY = Symbol('MARKETPLACE_ISSUANCE_SAGA_REPOSITORY');

export interface MarketplaceIssuanceSagaCreateInput {
  coopname: string;
  order_id: string;
  order_hash: string;
  proposal_id: string | null;
  member_account: string;
  operator_account: string;
  braname: string;
  fact: MarketplaceIssuanceSagaFact;
}

export interface MarketplaceIssuanceSagaPatch {
  stage?: MarketplaceIssuanceSagaStage;
  decision_mode?: MarketplaceIssuanceDecisionMode;
  fact?: MarketplaceIssuanceSagaFact;
  statement_document?: ISignedDocument | null;
  protocol_document?: ISignedDocument | null;
  act1_document?: ISignedDocument | null;
  act2_document?: ISignedDocument | null;
  act_document_hash?: string | null;
  decision_id?: string | null;
  tx_hashes?: MarketplaceIssuanceSagaTxHashes;
  last_error?: string | null;
  attempts?: number;
  step_claimed_at?: Date | null;
  step_claimed_by?: string | null;
  decided_at?: Date | null;
  closed_at?: Date | null;
}

export interface MarketplaceIssuanceSagaListFilter {
  coopname: string;
  member_account?: string;
  braname?: string | string[];
  proposal_id?: string;
  stage?: MarketplaceIssuanceSagaStage | MarketplaceIssuanceSagaStage[];
  /** Только живые саги (этапы до закрытия). */
  active_only?: boolean;
}

export interface MarketplaceIssuanceSagaDomainRepository {
  /** Создать или вернуть существующую живую сагу по заказу (одна на заказ). */
  createOrReuse(input: MarketplaceIssuanceSagaCreateInput): Promise<MarketplaceIssuanceSagaDomainEntity>;
  findById(id: string): Promise<MarketplaceIssuanceSagaDomainEntity | null>;
  findByOrderHash(coopname: string, order_hash: string): Promise<MarketplaceIssuanceSagaDomainEntity | null>;
  /** Живая сага по заказу (этап до закрытия). */
  findActiveByOrderId(coopname: string, order_id: string): Promise<MarketplaceIssuanceSagaDomainEntity | null>;
  list(filter: MarketplaceIssuanceSagaListFilter): Promise<MarketplaceIssuanceSagaDomainEntity[]>;
  /**
   * Захватить текущий шаг выдачи перед отправкой в цепь: `true` — шаг взят
   * этим столом. Шаг занят, если его захватили позже `staleBefore`; более
   * старый захват считается брошенным (стол закрыли посреди подписи).
   */
  claimStep(id: string, stage: MarketplaceIssuanceSagaStage, by: string, now: Date, staleBefore: Date): Promise<boolean>;
  /** Снять захват: шаг не удался, его можно повторить с любого стола. */
  releaseStep(id: string): Promise<void>;
  /** Выдачи, где акт пайщика подписан раньше порога, а закрывающей подписи и напоминания нет. */
  listAwaitingCloseReminder(coopname: string, actSignedBefore: Date, limit: number): Promise<MarketplaceIssuanceSagaDomainEntity[]>;
  /** Отметить напоминание; `false` — отметку уже поставил другой прогон. */
  markCloseReminded(id: string, at: Date): Promise<boolean>;
  /**
   * Атомарный переход: применяет патч только если текущий этап — один из
   * ожидаемых. `null` — переход не применён (гонка или повтор), состояние не
   * тронуто; вызывающая сторона перечитывает запись.
   */
  transition(
    id: string,
    from: MarketplaceIssuanceSagaStage | MarketplaceIssuanceSagaStage[],
    patch: MarketplaceIssuanceSagaPatch
  ): Promise<MarketplaceIssuanceSagaDomainEntity | null>;
  /** Патч без проверки этапа (ошибки, попытки, номер решения). */
  update(id: string, patch: MarketplaceIssuanceSagaPatch): Promise<MarketplaceIssuanceSagaDomainEntity>;
  /** Саги в ожидании, не обновлявшиеся дольше порога — для сторожа. */
  findStale(coopname: string, stages: MarketplaceIssuanceSagaStage[], olderThan: Date, limit: number): Promise<MarketplaceIssuanceSagaDomainEntity[]>;
}
