import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import type {
  GeocodeStatus,
  KuDetailsStatus,
  WorkingHoursDomain,
} from '../../domain/entities/ku-details-domain.entity';

/**
 * TypeORM-сущность `marketplace_ku_details` — 1:1 расширение core `coop_ku`
 * с атрибутами, специфичными для Стола заказов (Эпик 2, Story 2.1).
 *
 * Уникальная пара (`coopname`, `core_braname`): на каждый core-КУ в одном
 * кооперативе — ровно одна marketplace-детализация. Удаление core-КУ
 * приводит к INACTIVE — запись физически сохраняется ради ссылочной
 * целостности с marketplace `Order` / `Shipment` (Эпики 4-5).
 */
@Entity('marketplace_ku_details')
@Index('idx_ku_details_coopname_braname', ['coopname', 'coreBraname'], { unique: true })
@Index('idx_ku_details_status', ['coopname', 'status'])
export class KuDetailsTypeormEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'coopname', type: 'varchar', length: 13 })
  coopname!: string;

  @Column({ name: 'core_braname', type: 'varchar', length: 13, comment: 'braname в core coop_ku' })
  coreBraname!: string;

  @Column({
    name: 'geocoded_address',
    type: 'varchar',
    length: 1000,
    nullable: true,
    comment: 'Адрес, по которому посчитаны координаты (кэш-ключ геокода)',
  })
  geocodedAddress?: string;

  @Column({ name: 'working_hours_json', type: 'jsonb' })
  workingHoursJson!: WorkingHoursDomain;

  @Column({ name: 'description', type: 'text', nullable: true })
  description?: string;

  @Column({
    name: 'status',
    type: 'enum',
    enum: ['ACTIVE', 'INACTIVE'],
    default: 'ACTIVE',
  })
  status!: KuDetailsStatus;

  @Column({ name: 'lat', type: 'double precision', nullable: true })
  lat?: number;

  @Column({ name: 'lng', type: 'double precision', nullable: true })
  lng?: number;

  @Column({
    name: 'geocode_status',
    type: 'enum',
    enum: ['PENDING', 'OK', 'FAILED'],
    default: 'PENDING',
  })
  geocodeStatus!: GeocodeStatus;

  @Column({ name: 'geocode_error_message', type: 'text', nullable: true })
  geocodeErrorMessage?: string;

  @Column({ name: 'geocoded_at', type: 'timestamp', nullable: true })
  geocodedAt?: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
