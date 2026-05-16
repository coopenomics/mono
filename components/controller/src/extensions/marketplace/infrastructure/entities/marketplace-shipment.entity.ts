import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type {
  MarketplaceShipmentDeliveryVariant,
  MarketplaceShipmentStatus,
  MarketplaceShipmentTTNData,
} from '../../domain/entities/marketplace-shipment.types';

/**
 * Story 5.1: TypeORM-сущность Shipment'а. Backend-only (нет on-chain зеркала)
 * — фиксирует группировку Order'ов одной консолидированной заявки по КУ +
 * вариант доставки.
 *
 * Естественный ключ unique: (coopname, cycle_id, ku_id) — одна заявка имеет
 * ровно одну группу на каждый КУ.
 *
 * Hot-path индексы:
 *   - `(coopname, offerer_account, status)` — offerer-стол "Подготовка
 *     поставки" (Story 5.1) и "Готовые к отправке" (Story 5.6 trigger);
 *   - `(coopname, ku_id, status)` — operator-стол КУ «Принять партии» (Story 5.3/5.4);
 *   - `(coopname, ttn_number)` unique sparse — Story 5.4 поиск по ТТН/штрих-коду.
 */
@Entity({ name: 'marketplace_shipment' })
@Index('IDX_marketplace_shipment_cycle_ku_unique', ['coopname', 'cycle_id', 'ku_id'], { unique: true })
@Index('IDX_marketplace_shipment_ttn_unique', ['coopname', 'ttn_number'], {
  unique: true,
  where: 'ttn_number IS NOT NULL',
})
@Index(['coopname', 'offerer_account', 'status'])
@Index(['coopname', 'ku_id', 'status'])
export class MarketplaceShipmentEntity {
  @PrimaryGeneratedColumn('uuid')
  public id!: string;

  @Column({ type: 'varchar', length: 13 })
  public coopname!: string;

  @Column({ type: 'uuid' })
  public cycle_id!: string;

  @Column({ type: 'varchar', length: 13 })
  public offerer_account!: string;

  @Column({ type: 'varchar', length: 13 })
  public ku_id!: string;

  @Column({ type: 'varchar', length: 1 })
  public delivery_variant!: MarketplaceShipmentDeliveryVariant;

  @Column({ type: 'numeric', precision: 24, scale: 4 })
  public total_amount!: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  public ttn_number!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  public ttn_data!: MarketplaceShipmentTTNData | null;

  @Column({ type: 'uuid', nullable: true })
  public ttn_document_registry_id!: string | null;

  @Column({ type: 'varchar', length: 1024, nullable: true })
  public ttn_pdf_url!: string | null;

  @Column({ type: 'varchar', length: 48 })
  public status!: MarketplaceShipmentStatus;

  @CreateDateColumn({ type: 'timestamptz' })
  public created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  public updated_at!: Date;
}
