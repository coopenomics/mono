import type {
  MarketplaceIssuanceDecisionMode,
  MarketplaceIssuanceSagaFact,
  MarketplaceIssuanceSagaProps,
  MarketplaceIssuanceSagaStage,
  MarketplaceIssuanceSagaTxHashes,
} from './marketplace-issuance-saga.types';
import { MARKETPLACE_ISSUANCE_SAGA_ACTIVE_STAGES } from './marketplace-issuance-saga.types';
import type { ISignedDocument } from '@coopenomics/innercoop';

/**
 * Сага выдачи имущества (паевая модель). Одна запись на заказ; этапы
 * идемпотентны: повтор события или мутации не создаёт второй транзакции.
 */
export class MarketplaceIssuanceSagaDomainEntity {
  public readonly id: string;
  public readonly coopname: string;
  public readonly order_id: string;
  public readonly order_hash: string;
  public readonly proposal_id: string | null;
  public readonly member_account: string;
  public readonly operator_account: string;
  public readonly braname: string;
  public stage: MarketplaceIssuanceSagaStage;
  public decision_mode: MarketplaceIssuanceDecisionMode;
  public fact: MarketplaceIssuanceSagaFact;
  public statement_document: ISignedDocument | null;
  public protocol_document: ISignedDocument | null;
  public act1_document: ISignedDocument | null;
  public act2_document: ISignedDocument | null;
  public act_document_hash: string | null;
  public decision_id: string | null;
  public tx_hashes: MarketplaceIssuanceSagaTxHashes;
  public last_error: string | null;
  public attempts: number;
  public decided_at: Date | null;
  public closed_at: Date | null;
  public readonly created_at: Date;
  public updated_at: Date;

  constructor(props: MarketplaceIssuanceSagaProps) {
    this.id = props.id;
    this.coopname = props.coopname;
    this.order_id = props.order_id;
    this.order_hash = props.order_hash.toLowerCase();
    this.proposal_id = props.proposal_id;
    this.member_account = props.member_account;
    this.operator_account = props.operator_account;
    this.braname = props.braname;
    this.stage = props.stage;
    this.decision_mode = props.decision_mode;
    this.fact = props.fact;
    this.statement_document = props.statement_document;
    this.protocol_document = props.protocol_document;
    this.act1_document = props.act1_document;
    this.act2_document = props.act2_document;
    this.act_document_hash = props.act_document_hash;
    this.decision_id = props.decision_id;
    this.tx_hashes = props.tx_hashes ?? {};
    this.last_error = props.last_error;
    this.attempts = props.attempts;
    this.decided_at = props.decided_at;
    this.closed_at = props.closed_at;
    this.created_at = props.created_at;
    this.updated_at = props.updated_at;
  }

  /** Сага ещё не завершена: кто-то должен подписать или ждём совет. */
  public get is_active(): boolean {
    return MARKETPLACE_ISSUANCE_SAGA_ACTIVE_STAGES.has(this.stage);
  }

  /** Пайщику есть что подписать прямо сейчас (заявление или акт). */
  public get awaits_member_signature(): boolean {
    return this.stage === 'FACT_FIXED' || this.stage === 'DECISION_AUTHORIZED';
  }

  /** Оператору есть что закрыть: акт с первой подписью пайщика. */
  public get awaits_operator_close(): boolean {
    return this.stage === 'ACT1_SIGNED';
  }

  /** Ждём решение совета — пайщику показывается режим ожидания. */
  public get awaits_council(): boolean {
    return this.stage === 'STATEMENT_SIGNED' || this.stage === 'DECISION_PENDING';
  }
}
