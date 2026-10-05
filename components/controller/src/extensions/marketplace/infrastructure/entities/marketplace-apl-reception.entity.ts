import type {
  MarketplaceAplReceptionExpeditorData,
  MarketplaceAplReceptionFactQuantityEntry,
  MarketplaceAplReceptionStatus,
  MarketplaceAplReceptionVariant,
} from '../../domain/entities/marketplace-apl-reception.types';
import type { ISignedDocument } from '@coopenomics/innercoop';

/**
 * Story 5.3 / 5.4: TypeORM-сущность АПП приёмки. Один Shipment имеет ровно
 * одну активную АПП (CANCELLED не блокирует повторную приёмку той же партии).
 *
 * Hot-path индексы:
 *   - `(coopname, shipment_id)` partial-unique WHERE status <> CANCELLED;
 *   - `(coopname, braname, status)` — operator-стол текущих АПП по КУ;
 *   - `(coopname, offerer_account, status)` — offerer-стол для асинхронной
 *     подписи (Вариант Б);
 *   - `(coopname, ttn_number)` partial-unique — Story 5.4 поиск по ТТН,
 *     тоже без CANCELLED (повторная приёмка той же ТТН после отката).
 */
export class MarketplaceAplReceptionEntity {
  public id!: string;

  public coopname!: string;

  public shipment_id!: string;

  public cycle_id!: string;

  public braname!: string;

  public offerer_account!: string;

  public variant!: MarketplaceAplReceptionVariant;

  public status!: MarketplaceAplReceptionStatus;

  public fact_quantity_per_order!: MarketplaceAplReceptionFactQuantityEntry[];

  // length=64 — копируется из shipment.ttn_number (см. marketplace-shipment.entity).
  public ttn_number!: string | null;

  public expeditor_data!: MarketplaceAplReceptionExpeditorData | null;

  public created_by_operator_account!: string;

  public supplier_signed_at!: Date | null;

  public supplier_signsupp_tx_hash!: string | null;

  public supplier_signed_documents!: ISignedDocument[] | null;

  public chairman_signed_at!: Date | null;

  public chairman_account!: string | null;

  public chairman_signchair_tx_hash!: string | null;

  public total_amount!: string;

  public created_at!: Date;

  public updated_at!: Date;
}
