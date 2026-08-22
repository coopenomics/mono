import type { SignedDocumentStatus } from '../enums/signed-document-status.enum';
import type { DocumentPackageAggregateDomainInterface } from '../interfaces/document-package-aggregate-domain.interface';

/**
 * Данные для записи/обновления одной записи реестра подписанных документов.
 * Одна запись = ОДИН документ (ключ — `doc_hash`, идентичность содержимого без подписей).
 * `hash` — крайняя подписанная версия (накопленные подписи), `packageHash` — идентификатор процесса,
 * общий для нескольких заявлений пакета (submitted↔resolved↔declined трекаются по `doc_hash`).
 */
export interface SignedDocumentUpsertInput {
  coopname: string;
  /** checksum256 процесса (`package` в blockchain-action; НЕ уникален — группирует документы) */
  packageHash: string;
  /** checksum256 содержимого документа — УНИКАЛЬНЫЙ ключ записи (без учёта подписей) */
  doc_hash: string;
  /** checksum256 подписанной версии (включает подписи) — крайняя версия документа */
  hash: string;
  username: string;
  status: SignedDocumentStatus;
  /** под-действие soviet (`data.action`) — для фильтрации списка по типам документов */
  action: string;
  registry_id: number;
  full_title: string;
  /** html заявления без тегов — для ILIKE-поиска */
  content_text: string;
  /** ФИО/наименования всех подписантов пакета + их username — для поиска по подписанту */
  signers_text: string;
  /** bigint из блокчейна приходит строкой */
  block_num: string | null;
  document_created_at: Date | null;
  /** готовый агрегат пакета (statement/decision/acts/links) — отдаётся getDocuments как есть */
  document_aggregate: DocumentPackageAggregateDomainInterface | null;
  /** data действия-носителя заявления — для пересборки агрегата при доприходе decision/act/link */
  source_action_data: Record<string, unknown> | null;
}

export interface SignedDocumentSearchParams {
  coopname: string;
  query: string;
  limit: number;
  /** ограничить поиск документами этого пайщика (для не-членов совета); undefined — весь кооператив */
  username?: string;
}

/**
 * Результат поиска — повторяет контракт SearchResultDTO (GraphQL `searchDocuments`).
 */
export interface SignedDocumentSearchHit {
  hash: string;
  /** Чистое наименование документа (meta.title), без служебного хвоста ` - - дата.pdf`. */
  full_title: string;
  username: string;
  /** ФИО подписанта-субъекта («Иванов Иван Иванович») для отображения вместо username. */
  signer: string;
  coopname: string;
  registry_id: number;
  created_at: string | null;
  highlights: string[];
}

/** Параметры выборки готовых агрегатов для списка документов (read-path getDocuments). */
export interface SignedDocumentListParams {
  coopname: string;
  status?: SignedDocumentStatus;
  /** фильтр по под-действиям (data.action) */
  actions?: string[];
  /** фильтр по пайщику */
  username?: string;
  /** фильтр по хэшу конкретного документа-заявления */
  hash?: string;
  afterBlock?: number;
  beforeBlock?: number;
  page: number;
  limit: number;
}

export interface SignedDocumentListResult {
  items: DocumentPackageAggregateDomainInterface[];
  total: number;
}

/**
 * Частичное обновление записи при ПЕРЕСБОРКЕ агрегата (доприход decision/act/link).
 * Затрагивает ТОЛЬКО агрегат-производные колонки. Поля жизненного цикла (status, block_num,
 * source_action_data, document_created_at) сюда НЕ входят: ими владеют статус-события
 * (newsubmitted/newresolved/newdeclined). Иначе пересборка, читающая старый row.status, откатила бы
 * параллельно проставленный resolved обратно в submitted (гонка freedecision: newresolved+newdecision
 * по одному package приходят одновременно).
 */
export interface SignedDocumentAggregateUpdate {
  document_aggregate: DocumentPackageAggregateDomainInterface | null;
  full_title: string;
  content_text: string;
  signers_text: string;
}

/** Состояние записи для guard'ов ingestion (не понижать статус / не откатывать версию подписи). */
export interface SignedDocumentState {
  status: SignedDocumentStatus;
  /** номер блока крайней версии (для сравнения «новее ли пришедшая версия») */
  blockNum: number | null;
}

/** Строка реестра для пересборки агрегата: документ пакета + его действие-носитель. */
export interface SignedDocumentPackageRow {
  doc_hash: string;
  hash: string;
  status: SignedDocumentStatus;
  sourceActionData: Record<string, unknown> | null;
}

/**
 * Репозиторий реестра подписанных документов (Postgres-проекция).
 * Единый источник для отображения (getDocuments) и поиска (searchDocuments) — задача C28-21.
 * Запись = один документ (ключ `doc_hash`); `package` группирует заявления одного процесса.
 */
export interface SignedDocumentRepository {
  /** Вставить или обновить запись по (coopname, doc_hash). */
  upsert(input: SignedDocumentUpsertInput): Promise<void>;

  /** Частично обновить ТОЛЬКО агрегат-производные колонки записи (по coopname, doc_hash).
   *  Используется пересборкой при доприходе decision/act/link — status/block_num/source НЕ трогаются
   *  (см. SignedDocumentAggregateUpdate: защита от отката resolved→submitted в гонке). */
  updateAggregate(coopname: string, docHash: string, fields: SignedDocumentAggregateUpdate): Promise<void>;

  /** Статус + номер блока крайней версии документа по его doc_hash (для guard'ов ingestion);
   *  null, если записи нет. */
  getState(coopname: string, docHash: string): Promise<SignedDocumentState | null>;

  /** Кол-во записей реестра по кооперативу (для авто-триггера backfill на пустой базе). */
  count(coopname: string): Promise<number>;

  /** Все заявления одного процесса (package) — для пересборки агрегатов при доприходе
   *  decision/act/link (на пакет может приходиться несколько заявлений с разными подписантами). */
  findByPackage(coopname: string, packageHash: string): Promise<SignedDocumentPackageRow[]>;

  /** Поиск по реестру (ILIKE по signers_text/full_title/content_text/username). */
  search(params: SignedDocumentSearchParams): Promise<SignedDocumentSearchHit[]>;

  /** Список готовых агрегатов с пагинацией и фильтрами (read-path getDocuments). */
  findAggregates(params: SignedDocumentListParams): Promise<SignedDocumentListResult>;
}

/** Токен для инъекции зависимости репозитория реестра подписанных документов. */
export const SIGNED_DOCUMENT_REPOSITORY = Symbol('SignedDocumentRepository');
