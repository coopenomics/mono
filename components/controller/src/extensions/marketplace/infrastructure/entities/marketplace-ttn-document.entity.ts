import type { MarketplaceShipmentTTNData } from '../../domain/entities/marketplace-shipment.types';

/**
 * Story 5.4: локальный реестр ТТН Варианта Б. Документ рендерится через
 * платформенный document-factory под registry_id=1103, но не публикуется
 * в общий реестр документов кооператива — хранится здесь до момента,
 * когда экспедиторы перейдут на платформу и смогут подписывать
 * перевозку on-chain.
 *
 * Hot-path индексы:
 *   - `(coopname, shipment_id)` unique — один Shipment = одна ТТН;
 *   - `(coopname, ttn_number)` unique — глобальная уникальность номера в кооперативе.
 */
export class MarketplaceTtnDocumentEntity {
  public id!: string;

  public coopname!: string;

  public shipment_id!: string;

  public ttn_number!: string;

  public registry_id!: number;

  public document_hash!: string;

  public content_html!: string;

  public meta!: Record<string, unknown>;

  public supplier_account!: string;

  public accept_braname!: string;

  public total_amount!: string;

  public currency!: string;

  public ttn_data!: MarketplaceShipmentTTNData;

  public created_at!: Date;

  public updated_at!: Date;
}
