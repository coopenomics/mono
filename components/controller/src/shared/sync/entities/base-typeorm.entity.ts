import { PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Column } from 'typeorm';

export class BaseTypeormEntity {
  @PrimaryGeneratedColumn('uuid')
  _id!: string;

  @Column({ type: 'integer', default: 0 })
  block_num!: number;

  @Column({ type: 'boolean', default: false })
  present!: boolean;

  @Column({ type: 'varchar' })
  status!: string;

  @CreateDateColumn({ type: 'timestamp' })
  _created_at!: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  _updated_at!: Date;

  /**
   * Story 6.4: детерминированный sha256(canonical-json(bc-namespace)).
   * NULL для legacy entity без namespace (миграция Epic 9.5). Используется Epic 7
   * nightly snapshot и Epic 8 reconciliation как контрольная сумма соответствия БД ↔ цепь.
   */
  @Column({ type: 'varchar', length: 64, nullable: true })
  _checksum?: string | null;


  /**
   * Получить имя таблицы для сущности
   * ДОЛЖЕН БЫТЬ ПЕРЕОПРЕДЕЛЕН в каждом наследнике!
   */
  static getTableName(): string {
    throw new Error('getTableName() must be implemented in subclass');
  }
}
