import { Entity, Column, Index } from 'typeorm';
import { BaseTypeormEntity } from '~/shared/sync/entities/base-typeorm.entity';

/**
 * Сущность для хранения записей времени работы над задачами
 * Используется для автоматического расчета и распределения времени между коммитами
 */
@Entity('capital_time_entries')
@Index(['contributor_hash', 'date'])
@Index(['issue_hash', 'date'])
export class TimeEntryEntity extends BaseTypeormEntity {
  @Column({ type: 'varchar', length: 64, comment: 'Хеш участника' })
  @Index()
  contributor_hash!: string;

  @Column({ type: 'varchar', length: 64, comment: 'Хеш задачи' })
  @Index()
  issue_hash!: string;

  @Column({ type: 'varchar', length: 64, comment: 'Хеш проекта' })
  @Index()
  project_hash!: string;

  @Column({ type: 'varchar', length: 64, comment: 'Имя кооператива' })
  coopname!: string;

  @Column({ type: 'date', comment: 'Дата работы (YYYY-MM-DD)' })
  date!: string;

  @Column({ type: 'numeric', comment: 'Количество часов' })
  hours!: number;

  @Column({ type: 'varchar', length: 64, nullable: true, comment: 'Хеш коммита, если время уже закоммичено' })
  commit_hash?: string;

  @Column({ type: 'boolean', default: false, comment: 'Флаг, что время закоммичено' })
  is_committed!: boolean;

  @Column({
    type: 'varchar',
    length: 20,
    nullable: true,
    default: 'hourly',
    comment: 'Тип начисления времени: hourly (почасовое) или estimate (по завершению задачи)',
  })
  @Index()
  entry_type?: string;

  @Column({
    type: 'numeric',
    nullable: true,
    comment: 'Снимок estimate на момент начисления времени (для отслеживания изменений)',
  })
  estimate_snapshot?: number;
}
