import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Тип тары кооператива (Эпик 19): габариты и объём одной закупленной партии
 * боксов. Отдельная сущность, потому что объём транспорта в перевозке между
 * участками считается агрегацией по типам, а не по каждому боксу.
 */
@Entity({ name: 'marketplace_container_type' })
@Index('IDX_marketplace_container_type_name_unique', ['coopname', 'name'], { unique: true })
@Index(['coopname', 'is_active'])
export class MarketplaceContainerTypeEntity {
  @PrimaryGeneratedColumn('uuid')
  public id!: string;

  @Column({ type: 'varchar', length: 13 })
  public coopname!: string;

  @Column({ type: 'varchar', length: 128 })
  public name!: string;

  @Column({ type: 'integer', default: 0 })
  public length_cm!: number;

  @Column({ type: 'integer', default: 0 })
  public width_cm!: number;

  @Column({ type: 'integer', default: 0 })
  public height_cm!: number;

  // default нужен, чтобы TypeORM смог добавить NOT NULL колонку на уже
  // существующих строках (расширение работает на synchronize). Реальное
  // значение проставит миграция v15, пересчитав его из габаритов.
  @Column({ type: 'numeric', precision: 12, scale: 4, default: 0 })
  public volume_m3!: string;

  @Column({ type: 'numeric', precision: 10, scale: 3, nullable: true })
  public max_weight_kg!: string | null;

  @Column({ type: 'boolean', default: true })
  public is_active!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  public created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  public updated_at!: Date;
}

/**
 * Бокс кооперативного участка (Эпик 19). Код уникален в пределах кооператива —
 * именно он кодируется в QR, и скан не должен быть двусмысленным.
 *
 * Hot-path индексы:
 *   - `(coopname, code)` unique — резолв отсканированного QR;
 *   - `(coopname, braname, is_active)` — реестр боксов своего участка;
 *   - `(coopname, cell_id)` — что стоит в ячейке (сетка склада).
 */
@Entity({ name: 'marketplace_container' })
@Index('IDX_marketplace_container_code_unique', ['coopname', 'code'], { unique: true })
@Index(['coopname', 'braname', 'is_active'])
@Index(['coopname', 'cell_id'])
export class MarketplaceContainerEntity {
  @PrimaryGeneratedColumn('uuid')
  public id!: string;

  @Column({ type: 'varchar', length: 13 })
  public coopname!: string;

  @Column({ type: 'varchar', length: 13 })
  public braname!: string;

  @Column({ type: 'varchar', length: 32 })
  public code!: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  public label!: string | null;

  @Column({ type: 'uuid' })
  public container_type_id!: string;

  // Ячейка, в которой стоит бокс. NULL — бокс не размещён, и это штатно.
  @Column({ type: 'uuid', nullable: true })
  public cell_id!: string | null;

  @Column({ type: 'boolean', default: true })
  public is_active!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  public created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  public updated_at!: Date;
}
