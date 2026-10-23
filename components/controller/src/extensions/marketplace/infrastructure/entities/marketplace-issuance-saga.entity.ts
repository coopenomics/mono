import type { ISignedDocument } from '@coopenomics/innercoop';
import type {
  MarketplaceIssuanceDecisionMode,
  MarketplaceIssuanceSagaFact,
  MarketplaceIssuanceSagaStage,
  MarketplaceIssuanceSagaTxHashes,
} from '../../domain/entities/marketplace-issuance-saga.types';

/**
 * Сага выдачи имущества (паевая модель, компонент 68). Одна запись на заказ;
 * документы этапов в jsonb — устройство пайщика и оператора берут их отсюда
 * для агрегата и второй подписи.
 *
 * Hot-path индексы: очередь стойки (braname + stage), экран пайщика
 * (member + stage), поиск по заказу (order_hash — уникален среди живых саг).
 */
export class MarketplaceIssuanceSagaEntity {
  public id!: string;

  public coopname!: string;

  public order_id!: string;

  public order_hash!: string;

  public proposal_id!: string | null;

  public member_account!: string;

  public operator_account!: string;

  public braname!: string;

  public stage!: MarketplaceIssuanceSagaStage;

  public decision_mode!: MarketplaceIssuanceDecisionMode;

  public fact!: MarketplaceIssuanceSagaFact;

  public statement_document!: ISignedDocument | null;

  public protocol_document!: ISignedDocument | null;

  public act1_document!: ISignedDocument | null;

  public act2_document!: ISignedDocument | null;

  public act_document_hash!: string | null;

  public decision_id!: string | null;

  public tx_hashes!: MarketplaceIssuanceSagaTxHashes;

  public last_error!: string | null;

  public attempts!: number;

  public decided_at!: Date | null;

  public closed_at!: Date | null;

  public created_at!: Date;

  public updated_at!: Date;
}
