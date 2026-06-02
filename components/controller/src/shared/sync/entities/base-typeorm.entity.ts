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
   * Получить имя таблицы для сущности
   * ДОЛЖЕН БЫТЬ ПЕРЕОПРЕДЕЛЕН в каждом наследнике!
   */
  static getTableName(): string {
    throw new Error('getTableName() must be implemented in subclass');
  }
}
