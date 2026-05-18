import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
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
@Entity({ name: 'marketplace_ttn_document' })
@Index(
  'IDX_marketplace_ttn_document_shipment_unique',
  ['coopname', 'shipment_id'],
  { unique: true }
)
@Index(
  'IDX_marketplace_ttn_document_number_unique',
  ['coopname', 'ttn_number'],
  { unique: true }
)
export class MarketplaceTtnDocumentEntity {
  @PrimaryGeneratedColumn('uuid')
  public id!: string;

  @Column({ type: 'varchar', length: 13 })
  public coopname!: string;

  @Column({ type: 'uuid' })
  public shipment_id!: string;

  @Column({ type: 'varchar', length: 128 })
  public ttn_number!: string;

  @Column({ type: 'integer' })
  public registry_id!: number;

  @Column({ type: 'varchar', length: 128 })
  public document_hash!: string;

  @Column({ type: 'text' })
  public content_html!: string;

  @Column({ type: 'jsonb' })
  public meta!: Record<string, unknown>;

  @Column({ type: 'varchar', length: 13 })
  public supplier_account!: string;

  @Column({ type: 'varchar', length: 64 })
  public accept_braname!: string;

  @Column({ type: 'numeric', precision: 24, scale: 4 })
  public total_amount!: string;

  @Column({ type: 'varchar', length: 16 })
  public currency!: string;

  @Column({ type: 'jsonb' })
  public ttn_data!: MarketplaceShipmentTTNData;

  @CreateDateColumn({ type: 'timestamptz' })
  public created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  public updated_at!: Date;
}
