import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { SignedDocumentStatus } from '~/domain/document/enums/signed-document-status.enum';
import type { DocumentPackageAggregateDomainInterface } from '~/domain/document/interfaces/document-package-aggregate-domain.interface';

/**
 * Реестр подписанных документов (Postgres-проекция, задача C28-21).
 *
 * Одна строка = ОДИН документ (уникальность по `doc_hash` — хэшу содержимого документа). Тонкость:
 * `doc_hash` — это сам документ, а `hash` включает наложенные подписи, поэтому ОДИН документ может
 * иметь несколько `hash` (версий по мере накопления подписей — напр. акт приёма-передачи: первая
 * подпись даёт один `hash`, вторая — другой, но `doc_hash` тот же). В реестре держим КРАЙНЮЮ версию
 * (по номеру блока) — иначе документ задвоился бы в списке. `hash` хранится как версия последней
 * подписи (для фильтра по конкретной версии и отображения).
 *
 * `package` — идентификатор ПРОЦЕССА (пакета), в который может входить НЕСКОЛЬКО разных документов
 * с разными подписантами (напр. обмен в marketplace: два newsubmitted с одним package). Поэтому
 * `package` НЕ уникален — это группирующая колонка (решение/акты/связи процесса тянутся по нему
 * в агрегат). Наполняется ingestion-листенером blockchain-событий soviet и разовым backfill'ом.
 *
 * `document_aggregate` хранит ГОТОВЫЙ агрегат пакета (statement/decision/acts/links вместе с
 * контентом и бинарём) — отсюда `getDocuments` отдаёт список без сборки на лету и без обращений
 * к explorer/Mongo. Колонки `full_title`/`content_text`/`action`/… — денормализованная проекция
 * для индексируемого поиска и фильтрации.
 *
 * Примечание: имя TS-поля `packageHash` (а не `package`) — `package` зарезервировано в strict-mode;
 * в БД колонка называется `package`.
 */
@Entity('signed_documents')
@Index(['coopname', 'doc_hash'], { unique: true })
@Index(['coopname', 'hash'])
@Index(['coopname', 'packageHash'])
@Index(['coopname', 'status'])
@Index(['coopname', 'status', 'action'])
@Index(['coopname', 'username'])
export class SignedDocumentEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 50 })
  coopname!: string;

  @Column({ name: 'package', length: 64 })
  packageHash!: string;

  /** checksum256 содержимого документа — УНИКАЛЬНАЯ идентичность документа (без учёта подписей) */
  @Column({ length: 64, default: '' })
  doc_hash!: string;

  /** checksum256 подписанной версии (включает подписи) — крайняя версия документа */
  @Column({ length: 64 })
  hash!: string;

  @Column({ length: 50, default: '' })
  username!: string;

  @Column({ type: 'varchar', length: 20, default: SignedDocumentStatus.Submitted })
  status!: SignedDocumentStatus;

  /** Под-действие soviet (`data.action`) — для фильтра getDocuments по типам документов */
  @Column({ type: 'varchar', length: 20, default: '' })
  action!: string;

  @Column({ type: 'int', default: 0 })
  registry_id!: number;

  @Column({ type: 'text', default: '' })
  full_title!: string;

  /** html заявления без тегов — индекс для ILIKE-поиска */
  @Column({ type: 'text', default: '' })
  content_text!: string;

  /** ФИО/наименования всех подписантов пакета (из signer_certificate всех частей агрегата) —
   * основной индекс для поиска по фамилии подписанта + их username */
  @Column({ type: 'text', default: '' })
  signers_text!: string;

  @Column({ type: 'bigint', nullable: true })
  block_num!: string | null;

  /** дата создания документа (из meta.created_at) — для сортировки списка */
  @Column({ type: 'timestamptz', nullable: true })
  document_created_at!: Date | null;

  /** ГОТОВЫЙ агрегат пакета: statement/decision/acts/links c контентом и бинарём (PDF base64) */
  @Column({ type: 'jsonb', nullable: true })
  document_aggregate!: DocumentPackageAggregateDomainInterface | null;

  /** действие-носитель заявления (newsubmitted/newresolved/newdeclined) целиком — для пересборки
   * агрегата при доприходе newdecision/newact/newlink по тому же пакету */
  @Column({ type: 'jsonb', nullable: true })
  source_action_data!: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at' })
  created_at!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at!: Date;
}
