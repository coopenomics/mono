import { Entity, Column, Index } from 'typeorm';
import { BaseTypeormEntity } from '@coopenomics/extension-kit/sync';

/**
 * Сущность для хранения записей времени работы над задачами
 * Используется для автоматического расчета и распределения времени между коммитами
 */
@Entity('capital_time_entries')
@Index(['contributor_hash', 'date'])
@Index(['issue_hash', 'date'])
export class TimeEntryEntity extends BaseTypeormEntity {
  // i18n-ignore: комментарий к колонке БД (TypeORM comment), техническое поле, до пайщика не доходит
  @Column({ type: 'varchar', length: 64, comment: 'Хеш участника' })
  @Index()
  contributor_hash!: string;

  // i18n-ignore: комментарий к колонке БД (TypeORM comment), техническое поле, до пайщика не доходит
  @Column({ type: 'varchar', length: 64, comment: 'Хеш задачи' })
  @Index()
  issue_hash!: string;

  // i18n-ignore: комментарий к колонке БД (TypeORM comment), техническое поле, до пайщика не доходит
  @Column({ type: 'varchar', length: 64, comment: 'Хеш проекта' })
  @Index()
  project_hash!: string;

  // i18n-ignore: комментарий к колонке БД (TypeORM comment), техническое поле, до пайщика не доходит
  @Column({ type: 'varchar', length: 64, comment: 'Имя кооператива' })
  coopname!: string;

  // i18n-ignore: комментарий к колонке БД (TypeORM comment), техническое поле, до пайщика не доходит
  @Column({ type: 'date', comment: 'Дата работы (YYYY-MM-DD)' })
  date!: string;

  // i18n-ignore: комментарий к колонке БД (TypeORM comment), техническое поле, до пайщика не доходит
  @Column({ type: 'numeric', comment: 'Количество часов' })
  hours!: number;

  // i18n-ignore: комментарий к колонке БД (TypeORM comment), техническое поле, до пайщика не доходит
  @Column({ type: 'varchar', length: 64, nullable: true, comment: 'Хеш коммита, если время уже закоммичено' })
  commit_hash?: string;

  // i18n-ignore: комментарий к колонке БД (TypeORM comment), техническое поле, до пайщика не доходит
  @Column({ type: 'boolean', default: false, comment: 'Флаг, что время закоммичено' })
  is_committed!: boolean;

  @Column({
    type: 'varchar',
    length: 20,
    nullable: true,
    default: 'hourly',
    // i18n-ignore: комментарий к колонке БД (TypeORM comment), техническое поле, до пайщика не доходит
    comment: 'Тип начисления времени: hourly (почасовое) или estimate (по завершению задачи)',
  })
  @Index()
  entry_type?: string;

  @Column({
    type: 'numeric',
    nullable: true,
    // i18n-ignore: комментарий к колонке БД (TypeORM comment), техническое поле, до пайщика не доходит
    comment: 'Снимок estimate на момент начисления времени (для отслеживания изменений)',
  })
  estimate_snapshot?: number;
}
