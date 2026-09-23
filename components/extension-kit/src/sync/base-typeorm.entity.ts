import { PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Column } from 'typeorm';

export class BaseTypeormEntity {
  @PrimaryGeneratedColumn('uuid')
  _id!: string;

  @Column({ type: 'integer', default: 0 })
  block_num!: number;

  @Column({ type: 'boolean', default: false })
  present!: boolean;

  /**
   * Значение по умолчанию задано явно: часть наследников (кошельки и соглашения
   * пайщика, комментарии и голоса Благороста, состояние программы) статус в
   * домене не заводит и пишет строку без него. До C28-79 умолчание сюда
   * «утекало» от соседнего наследника через ошибку TypeORM и зависело от порядка
   * загрузки сущностей; теперь — `UNDEFINED`, как у неизвестного статуса в
   * `auditUnknownStatus`. Наследник со своим статусом переопределяет колонку.
   */
  @Column({ type: 'varchar', default: 'UNDEFINED' })
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
