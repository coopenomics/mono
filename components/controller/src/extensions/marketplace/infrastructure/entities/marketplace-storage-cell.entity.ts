import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * TypeORM-сущность ячейки хранения склада КУ (Эпик 19).
 *
 * Координаты `(section, level)` уникальны в пределах участка — две ячейки с
 * одним адресом на одном складе физически невозможны. Отдельно уникален `code`:
 * оператор ищет ячейку по адресу, и адрес не должен быть двусмысленным.
 *
 * Hot-path индексы:
 *   - `(coopname, braname, is_active)` — сетка склада своего КУ;
 *   - `(coopname, braname, section, level)` unique — координатный адрес;
 *   - `(coopname, braname, code)` unique — поиск по человекочитаемому адресу.
 */
@Entity({ name: 'marketplace_storage_cell' })
@Index('IDX_marketplace_storage_cell_coords_unique', ['coopname', 'braname', 'section', 'level'], {
  unique: true,
})
@Index('IDX_marketplace_storage_cell_code_unique', ['coopname', 'braname', 'code'], { unique: true })
@Index(['coopname', 'braname', 'is_active'])
export class MarketplaceStorageCellEntity {
  @PrimaryGeneratedColumn('uuid')
  public id!: string;

  @Column({ type: 'varchar', length: 13 })
  public coopname!: string;

  @Column({ type: 'varchar', length: 13 })
  public braname!: string;

  // Координата-столбец: секция/стеллаж.
  @Column({ type: 'varchar', length: 64 })
  public section!: string;

  // Координата-строка: ярус, нумерация с 1.
  @Column({ type: 'integer' })
  public level!: number;

  // Человекочитаемый адрес; у перенесённых полок сохраняет исходную подпись.
  @Column({ type: 'varchar', length: 64 })
  public code!: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  public label!: string | null;

  @Column({ type: 'boolean', default: true })
  public is_active!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  public created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  public updated_at!: Date;
}
