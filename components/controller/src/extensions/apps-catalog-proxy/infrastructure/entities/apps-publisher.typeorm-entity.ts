/**
 * Издатель приложения (487-27): пайщик, которому кооператив доверил
 * публиковать ОДИН пакет каталога. Ключи каталога хранятся в самом
 * каталоге (только sha256); здесь — только назначение «аккаунт → пакет»,
 * по которому mono пропускает запросы издателя на выпуск/отзыв ключей.
 */
import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';

export const AppsPublisherEntityName = 'apps_publishers';

@Entity(AppsPublisherEntityName)
@Unique(`uq_${AppsPublisherEntityName}_assignment`, ['coopname', 'username', 'package_id'])
@Index(`idx_${AppsPublisherEntityName}_user`, ['coopname', 'username'])
export class AppsPublisherTypeormEntity {
  @PrimaryGeneratedColumn('uuid')
  _id!: string;

  @Column({ type: 'varchar', length: 12 })
  coopname!: string;

  /** Пайщик-издатель. */
  @Column({ type: 'varchar', length: 12 })
  username!: string;

  /** Пакет каталога `@coopname/name`. */
  @Column({ type: 'varchar', length: 214 })
  package_id!: string;

  /** Кто назначил (председатель). */
  @Column({ type: 'varchar', length: 12 })
  added_by!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;
}
